// Импорт видимости из Топвизора: основной проект (avo.estate) + конкуренты.
// Маппинг по домену → наш Site → наш Project.
// Запуск: npm run import:topvisor  (по умолчанию 180 дней)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://api.topvisor.com/v2/json";

const USER_ID = process.env.TOPVISOR_USER_ID!;
const API_KEY = process.env.TOPVISOR_API_KEY!;
const PROJECT_ID = Number(process.env.TOPVISOR_PROJECT_ID);
const REGION_INDEX = Number(process.env.TOPVISOR_REGION_INDEX ?? 1);

type Series = {
  visibility?: (number | null)[];
  avg?: (number | null)[];
  tops?: Record<string, (number | null)[]>;
};
type ChartResult = {
  result: { seriesByProjectsId: Record<string, Series>; dates: string[] };
};

async function tv(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "User-Id": USER_ID,
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(
      `${path}: ${json.errors.map((e: { string: string }) => e.string).join(", ")}`
    );
  }
  return json;
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchChart(competitorsIds: number[] | null, date1: string, date2: string) {
  const body: Record<string, unknown> = {
    project_id: PROJECT_ID,
    region_index: REGION_INDEX,
    show_visibility: true,
    show_avg: true,
    show_tops: true,
    date1,
    date2,
    type_range: 2,
  };
  if (competitorsIds) body.competitors_ids = competitorsIds;
  const json = (await tv("get/positions_2/summary/chart/", body)) as ChartResult;
  return json.result;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" ? v : 0;
}

async function main() {
  const days = Number(process.argv[2]) || 180;
  if (!USER_ID || !API_KEY || !PROJECT_ID) {
    throw new Error("Не заданы TOPVISOR_USER_ID / TOPVISOR_API_KEY / TOPVISOR_PROJECT_ID");
  }
  const date1 = daysAgoISO(days);
  const date2 = daysAgoISO(0);

  // 1. Основной сайт проекта
  const projInfo = await tv("get/projects_2/projects/", {
    fields: ["id", "site"],
    filters: [{ name: "id", operator: "EQUALS", values: [PROJECT_ID] }],
  });
  const mainDomain: string = projInfo.result[0].site;

  // 2. Конкуренты (id → домен), только включённые (on != -1)
  const compRes = await tv("get/projects_2/competitors/", {
    project_id: PROJECT_ID,
    fields: ["id", "site", "on"],
  });
  const competitors: { id: number; site: string; on: number }[] = compRes.result;
  const enabled = competitors.filter((c) => c.on !== -1);

  // id серии → домен
  const idToDomain = new Map<string, string>();
  idToDomain.set(String(PROJECT_ID), mainDomain);
  for (const c of enabled) idToDomain.set(String(c.id), c.site);

  // 3. Наш маппинг: домен → projectId (через связанный сайт)
  const ourProjects = await prisma.project.findMany({
    include: { site: true },
  });
  const domainToProjectId = new Map<string, string>();
  for (const p of ourProjects) {
    if (p.site?.domain) domainToProjectId.set(p.site.domain.toLowerCase(), p.id);
  }

  // 4. Графики: основной проект (без competitors_ids) + конкуренты
  const mainChart = await fetchChart(null, date1, date2);
  const compChart = await fetchChart(
    enabled.map((c) => c.id),
    date1,
    date2
  );

  const chunks = [mainChart, compChart];
  let imported = 0;

  for (const chart of chunks) {
    const dates = chart.dates;
    for (const [seriesId, series] of Object.entries(chart.seriesByProjectsId)) {
      const domain = idToDomain.get(seriesId);
      if (!domain) continue;
      const projectId = domainToProjectId.get(domain.toLowerCase());
      if (!projectId) {
        console.log(`  ⚠ нет нашего проекта для домена ${domain} — пропуск`);
        continue;
      }

      const tops = series.tops || {};
      let rows = 0;
      for (let i = 0; i < dates.length; i++) {
        const vis = series.visibility?.[i];
        if (vis === null || vis === undefined) continue; // нет проверки в эту дату
        const date = new Date(dates[i]);
        const top10 = num(tops["1_10"]?.[i]);
        const top50 =
          num(tops["1_10"]?.[i]) +
          num(tops["11_30"]?.[i]) +
          num(tops["31_50"]?.[i]);
        const data = {
          visibility: Math.round(num(vis) * 100) / 100,
          avgPosition: Math.round(num(series.avg?.[i]) * 10) / 10,
          top3: num(tops["1_3"]?.[i]),
          top10,
          top50,
          queriesTotal: num(tops["all"]?.[i]),
        };
        await prisma.visibilityData.upsert({
          where: { projectId_date: { projectId, date } },
          create: { projectId, date, ...data },
          update: data,
        });
        rows++;
      }
      imported += rows;
      console.log(`  ✓ ${domain}: ${rows} проверок`);
    }
  }
  console.log(`🎉 Импорт видимости завершён, записей: ${imported}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
