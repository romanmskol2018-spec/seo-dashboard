import Link from "next/link";

const OPTIONS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
];

export function PeriodSwitcher({ current }: { current: number }) {
  return (
    <div className="inline-flex bg-surface border border-border rounded-lg p-1">
      {OPTIONS.map((o) => (
        <Link
          key={o.days}
          href={`/?period=${o.days}`}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            current === o.days
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
