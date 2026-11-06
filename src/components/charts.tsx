"use client";

import { useEffect, useRef, useState } from "react";

// Biểu đồ trang Báo cáo – HTML / SVG thuần, không thêm thư viện.
// Màu: trạng thái là thang thứ tự một sắc xanh (nhạt = chưa bắt đầu, đậm = xong), đã kiểm bằng
// validate_palette --ordinal; hai đường theo thời gian dùng ô màu phân loại 1 và 2 (xanh, cam).

export const STATUS_RAMP: Record<string, string> = {
  moi: "#86b6ef",
  "san-sang": "#649fe9",
  "dang-lam": "#4588e0",
  "cho-duyet": "#2c71cc",
  "dang-kiem-tra": "#205aaa",
  xong: "#164382",
  released: "#0b2f5e",
};
const SERIES = ["#2a78d6", "#eb6834"];
const HEAT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] };

// Một tooltip cho mỗi biểu đồ, đặt theo vị trí con trỏ trong khung (ref của khung truyền vào)
function useTooltip(ref: React.RefObject<HTMLDivElement | null>) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: { clientX: number; clientY: number }, t: Omit<Tip, "x" | "y">) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ ...t, x: e.clientX - box.left, y: e.clientY - box.top });
  };
  const showAt = (el: Element, t: Omit<Tip, "x" | "y">) => {
    const r = el.getBoundingClientRect();
    show({ clientX: r.left + r.width / 2, clientY: r.top }, t);
  };
  const hide = () => setTip(null);
  return { tip, show, showAt, hide };
}

function TooltipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      <div className="mb-0.5 font-medium text-slate-500">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-0.5 w-3 rounded" style={{ background: r.color }} />}
          <b className="text-slate-900 tabular-nums">{r.value}</b>
          <span className="text-slate-600">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className={i.line ? "h-0.5 w-4 rounded" : "h-2.5 w-2.5 rounded-sm"}
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function TableView({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-slate-500 select-none hover:text-slate-800">Xem dạng bảng</summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

// ---- Tiến độ từng đợt: thanh chồng theo trạng thái ----

export type ReleaseBar = {
  code: string;
  description: string;
  total: number;
  done: number;
  pct: number;
  byStatus: Record<string, number>;
};

export function ReleaseProgress({
  releases,
  statuses,
}: {
  releases: ReleaseBar[];
  statuses: { value: string; label: string }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const t = useTooltip(box);
  return (
    <div ref={box} className="relative">
      <Legend items={statuses.map((s) => ({ label: s.label, color: STATUS_RAMP[s.value] }))} />
      <ul className="mt-4 space-y-4">
        {releases.map((r) => {
          const parts = statuses.filter((s) => r.byStatus[s.value] > 0);
          return (
            <li key={r.code}>
              <div className="mb-1 flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-slate-900">{r.code}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={r.description}>
                  {r.description}
                </span>
                <span className="shrink-0 text-xs text-slate-600 tabular-nums">
                  <b className="text-slate-900">{r.pct}%</b> · {r.done}/{r.total} xong
                </span>
              </div>
              <div className="flex h-5 gap-[2px]" onPointerLeave={t.hide}>
                {r.total === 0 ? (
                  <div className="h-full flex-1 rounded bg-slate-100" />
                ) : (
                  parts.map((s, i) => {
                    const n = r.byStatus[s.value];
                    const tip = {
                      title: `${r.code} · ${s.label}`,
                      rows: [{ label: `việc (${Math.round((n / r.total) * 100)}%)`, value: String(n) }],
                    };
                    return (
                      <div
                        key={s.value}
                        tabIndex={0}
                        aria-label={`${r.code}, ${s.label}: ${n} việc`}
                        onPointerMove={(e) => t.show(e, tip)}
                        onFocus={(e) => t.showAt(e.currentTarget, tip)}
                        onBlur={t.hide}
                        className={`h-full outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          i === 0 ? "rounded-l" : ""
                        } ${i === parts.length - 1 ? "rounded-r" : ""}`}
                        style={{ flexGrow: n, flexBasis: 0, background: STATUS_RAMP[s.value] }}
                      />
                    );
                  })
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <TooltipBox tip={t.tip} />
      <TableView>
        <table className="w-full text-left tabular-nums">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Đợt</th>
              {statuses.map((s) => (
                <th key={s.value} className="py-1 pr-3 text-right font-medium">
                  {s.label}
                </th>
              ))}
              <th className="py-1 text-right font-medium">% xong</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="py-1 pr-3">{r.code}</td>
                {statuses.map((s) => (
                  <td key={s.value} className="py-1 pr-3 text-right">
                    {r.byStatus[s.value]}
                  </td>
                ))}
                <td className="py-1 text-right">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </div>
  );
}

// ---- Việc theo thời gian: tổng việc đã nhận và số việc đã xong (cộng dồn) ----

export function Burnup({ points }: { points: { date: string; scope: number; done: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const t = useTooltip(box);
  const [hover, setHover] = useState<number | null>(null);
  // vẽ theo đúng bề rộng khung để chữ trục không bị co nhỏ trên điện thoại
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220;
  const pad = { l: 32, r: 76, t: 12, b: 26 };
  const max = Math.max(1, ...points.map((p) => p.scope));
  const step = max <= 10 ? 2 : max <= 50 ? 10 : 20;
  const yMax = Math.ceil(max / step) * step;
  const x = (i: number) =>
    pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const series = [
    { key: "scope" as const, label: "Tổng việc", color: SERIES[0] },
    { key: "done" as const, label: "Đã xong", color: SERIES[1] },
  ];
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const last = points[points.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
    const p = points[best];
    t.show(e, {
      title: fmt(p.date),
      rows: series.map((s) => ({ label: s.label, value: String(p[s.key]), color: s.color })),
    });
  };

  return (
    <div ref={box} className="relative">
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, line: true }))} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full touch-none"
        role="img"
        aria-label={`Ngày ${fmt(last.date)}: tổng ${last.scope} việc, đã xong ${last.done}`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null);
          t.hide();
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e7e5e0" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px]">
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {fmt(p.date)}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#a3a29c" strokeWidth={1} />
        )}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(" ")}
            />
            {points.map((p, i) =>
              points.length <= 12 || i === hover ? (
                <circle key={i} cx={x(i)} cy={y(p[s.key])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              ) : null,
            )}
            {/* nhãn trực tiếp ở cuối đường */}
            <text x={x(points.length - 1) + 8} y={y(last[s.key])} dy="0.32em" className="fill-slate-700 text-[11px]">
              {s.label} {last[s.key]}
            </text>
          </g>
        ))}
      </svg>
      <TooltipBox tip={t.tip} />
      <TableView>
        <table className="w-full text-left tabular-nums">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Ngày</th>
              <th className="py-1 pr-3 text-right font-medium">Tổng việc</th>
              <th className="py-1 text-right font-medium">Đã xong</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-t border-slate-100">
                <td className="py-1 pr-3">{p.date}</td>
                <td className="py-1 pr-3 text-right">{p.scope}</td>
                <td className="py-1 text-right">{p.done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </div>
  );
}

// ---- Việc chưa xong theo mảng × ưu tiên ----

export function OpenHeatmap({
  rows,
  priorities,
}: {
  rows: { area: string; label: string; cells: { priority: string; n: number }[] }[];
  priorities: { value: string; label: string }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const t = useTooltip(box);
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.n)));
  const color = (n: number) => (n === 0 ? "#f3f2ef" : HEAT[Math.min(HEAT.length - 1, Math.round((n / max) * (HEAT.length - 1)))]);
  return (
    <div ref={box} className="relative">
      <div
        className="grid gap-[2px] text-xs"
        style={{ gridTemplateColumns: `minmax(90px, 1.2fr) repeat(${priorities.length}, minmax(0, 1fr))` }}
        onPointerLeave={t.hide}
      >
        <div />
        {priorities.map((p) => (
          <div key={p.value} className="pb-1 text-center text-slate-500" title={p.label}>
            {p.value}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.area} className="contents">
            <div className="flex items-center pr-2 text-slate-700">{r.label}</div>
            {r.cells.map((c) => {
              const tip = {
                title: `${r.label} · ${priorities.find((p) => p.value === c.priority)?.label ?? c.priority}`,
                rows: [{ label: "việc chưa xong", value: String(c.n) }],
              };
              const darkCell = c.n > 0 && (c.n / max) * (HEAT.length - 1) >= 3;
              return (
                <div
                  key={c.priority}
                  tabIndex={0}
                  aria-label={`${tip.title}: ${c.n} việc chưa xong`}
                  onPointerMove={(e) => t.show(e, tip)}
                  onFocus={(e) => t.showAt(e.currentTarget, tip)}
                  onBlur={t.hide}
                  className={`flex h-10 items-center justify-center rounded font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    darkCell ? "text-white" : c.n ? "text-slate-900" : "text-slate-400"
                  }`}
                  style={{ background: color(c.n) }}
                >
                  {c.n}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <TooltipBox tip={t.tip} />
      <p className="mt-2 text-xs text-slate-500">Màu càng đậm càng nhiều việc. P0 = chặn phát hành, P1 = làm ngay.</p>
    </div>
  );
}
