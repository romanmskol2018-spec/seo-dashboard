// Импорт трафика из Яндекс.Метрики по всем сайтам со счётчиком.
// Запуск: npm run import:metrika  (по умолчанию 90 дней)
//         npm run import:metrika -- 30
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api-metrika.yandex.net/stat/v1/data";

async function fetchCounter(counter: string, days: number, token: string) {
  const params = new URLSearchParams({
    ids: counter,
    metrics:
      "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDuration",
    dimensions: "ym:s:date",
    // Только SEO-трафик: переходы из поисковых систем (органика)
    filters: "ym:s:lastsignTrafficSource=='organic'",
    date1: `${days}daysAgo`,
    date2: "today",
    group: "day",
    limit: "100000",
  });
  let res: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(`${API}?${params}`, {
        headers: { Authorization: `OAuth ${token}` },
      });
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (!res) throw new Error(`сеть: ${(lastErr as Error)?.message || "fetch failed"}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.data || []).map(
    (row: { dimensions: { name: string }[]; metrics: number[] }) => ({
      date: row.dimensions[0].name,
      visits: Math.round(row.metrics[0] || 0),
      visitors: Math.round(row.metrics[1] || 0),
      pageviews: Math.round(row.metrics[2] || 0),
      bounceRate: Math.round((row.metrics[3] || 0) * 10) / 10,
      avgDuration: Math.round(row.metrics[4] || 0),
    })
  );
}

async function main() {
  const days = Number(process.argv[2]) || 90;
  const token = process.env.YANDEX_METRIKA_TOKEN;
  if (!token) throw new Error("Не задан YANDEX_METRIKA_TOKEN в .env");

  const sites = await prisma.site.findMany({
    where: { metrikaCounter: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`📥 Импорт из Метрики за ${days} дней, сайтов: ${sites.length}`);

  for (const site of sites) {
    try {
      const rows = await fetchCounter(site.metrikaCounter!, days, token);
      for (const r of rows) {
        const date = new Date(r.date);
        const data = {
          visits: r.visits,
          visitors: r.visitors,
          pageviews: r.pageviews,
          bounceRate: r.bounceRate,
          avgDuration: r.avgDuration,
        };
        await prisma.trafficData.upsert({
          where: {
            siteId_date_source: { siteId: site.id, date, source: "all" },
          },
          create: { siteId: site.id, date, source: "all", ...data },
          update: data,
        });
      }
      const total = rows.reduce(
        (s: number, r: { visits: number }) => s + r.visits,
        0
      );
      console.log(`  ✓ ${site.name}: ${rows.length} дн., ${total} визитов`);
    } catch (e) {
      console.log(`  ✗ ${site.name}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 600)); // пауза между сайтами
  }
  console.log("🎉 Импорт завершён");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
