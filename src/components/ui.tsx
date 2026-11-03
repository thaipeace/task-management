import { AREAS, PRIORITIES, STATUSES, TYPES, optionOf } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const o = optionOf(STATUSES, status);
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${o?.color ?? "bg-slate-100"}`}
    >
      {o?.label ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const o = optionOf(PRIORITIES, priority);
  return (
    <span
      title={o?.label}
      className={`inline-flex min-w-7 justify-center rounded px-1 py-0.5 text-[11px] font-bold ${o?.color ?? "bg-slate-200"}`}
    >
      {priority}
    </span>
  );
}

export function AreaBadge({ area }: { area: string }) {
  const o = optionOf(AREAS, area);
  return (
    <span
      title={o?.label}
      className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${o?.color ?? "bg-slate-100"}`}
    >
      {area}
    </span>
  );
}

export function TypeIcon({ type }: { type: string }) {
  const o = optionOf(TYPES, type);
  return (
    <span title={o?.label ?? type} className="text-sm leading-none">
      {o?.icon ?? "•"}
    </span>
  );
}

export function Avatar({ name, size = 24 }: { name: string | null | undefined; size?: number }) {
  if (!name) {
    return (
      <span
        title="Chưa giao"
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400"
      >
        ?
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      title={name}
      style={{ width: size, height: size, background: `hsl(${hash} 55% 45%)`, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Đang tải…" }: { label?: string }) {
  return <div className="animate-pulse p-6 text-sm text-slate-400">{label}</div>;
}
