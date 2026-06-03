import { prisma } from "@/lib/prisma";

const API = "https://api-metrika.yandex.net/stat/v1/data";

export type MetrikaDayRow = {
  date: string; // YYYY-MM-DD
  visits: number;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgDuration: number;
};

// Запрос дневной статистики по одному счётчику за период
export async function fetchCounterTraffic(
  counter: string,
  days: number,
  token: string
): Promise<MetrikaDayRow[]> {
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

  const res = await fetch(`${API}?${params.toString()}`, {
    headers: { Authorization: `OAuth ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Метрика ${counter}: HTTP ${res.status} ${text.slice(0, 200)}`
    );
  }

  const json = await res.json();
  const rows: MetrikaDayRow[] = (json.data || []).map(
    (row: { dimensions: { name: string }[]; metrics: number[] }) => ({
      date: row.dimensions[0].name,
      visits: Math.round(row.metrics[0] || 0),
      visitors: Math.round(row.metrics[1] || 0),
      pageviews: Math.round(row.metrics[2] || 0),
      bounceRate: Math.round((row.metrics[3] || 0) * 10) / 10,
      avgDuration: Math.round(row.metrics[4] || 0),
    })
  );
  return rows;
}

export type ImportResult = {
  site: string;
  counter: string;
  ok: boolean;
  rows?: number;
  error?: string;
};

// Импорт трафика по всем сайтам, у которых указан счётчик Метрики
export async function importMetrikaForAllSites(
  days: number
): Promise<ImportResult[]> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  if (!token) throw new Error("Не задан YANDEX_METRIKA_TOKEN");

  const sites = await prisma.site.findMany({
    where: { metrikaCounter: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  const results: ImportResult[] = [];
  for (const site of sites) {
    const counter = site.metrikaCounter!;
    try {
      const rows = await fetchCounterTraffic(counter, days, token);
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
      results.push({
        site: site.name,
        counter,
        ok: true,
        rows: rows.length,
      });
    } catch (e) {
      results.push({
        site: site.name,
        counter,
        ok: false,
        error: (e as Error).message,
      });
    }
  }
  return results;
}
