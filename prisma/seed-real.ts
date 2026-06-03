// Разовый скрипт: очистка демо-данных и загрузка реальных проектов.
// Запуск: npm run db:seed:real
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS = [
  { name: "Avo.Estate", domain: "avo.estate", metrika: "96256787", color: "#3b82f6" },
  { name: "Bayside Residence_new", domain: "baysideresidence.life", metrika: "92105983", color: "#8b5cf6" },
  { name: "bayside-residence.ru", domain: "bayside-residence.ru", metrika: "69432964", color: "#10b981" },
  { name: "Highwood Residence", domain: "highwoodresidence.life", metrika: "103475384", color: "#f59e0b" },
  { name: "Lakeside Residence", domain: "lakesideresidence.life", metrika: "97118613", color: "#ef4444" },
  { name: "Noco", domain: "noco.estate", metrika: "105969960", color: "#06b6d4" },
  { name: "novostroikino.ru", domain: "novostroikino.ru", metrika: "103613231", color: "#ec4899" },
  { name: "Woodside Residence", domain: "woodsideresidence.life", metrika: "92124318", color: "#84cc16" },
];

async function main() {
  console.log("🧹 Удаляю старые данные (админ сохраняется)…");
  await prisma.trafficData.deleteMany();
  await prisma.visibilityData.deleteMany();
  await prisma.project.deleteMany();
  await prisma.site.deleteMany();

  console.log("➕ Создаю сайты и проекты…");
  for (const it of ITEMS) {
    const site = await prisma.site.create({
      data: {
        name: it.name,
        domain: it.domain,
        metrikaCounter: it.metrika,
        color: it.color,
      },
    });
    await prisma.project.create({
      data: {
        name: it.name,
        searchEngine: "Яндекс",
        color: it.color,
        siteId: site.id,
      },
    });
    console.log(`  ✓ ${it.name}`);
  }

  const sites = await prisma.site.count();
  const projects = await prisma.project.count();
  console.log(`🎉 Готово: сайтов ${sites}, проектов ${projects}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
