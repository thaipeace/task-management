import { PACE, fmtDay, type Pace, type Weekly } from "@/lib/weekly";

const TONE = {
  good: { cls: "bg-green-100 text-green-800", icon: "✓" },
  warn: { cls: "bg-amber-100 text-amber-900", icon: "!" },
  bad: { cls: "bg-red-100 text-red-800", icon: "⚠" },
} as const;

export function PaceBadge({ pace }: { pace: Pace }) {
  const t = TONE[PACE[pace].tone];
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${t.cls}`}>
      <span aria-hidden>{t.icon} </span>
      {PACE[pace].label}
    </span>
  );
}

// thanh tiến độ: phần đậm = xong trước tuần này, phần nhạt = xong trong tuần; vạch = nhịp đều lẽ ra phải đạt
export function GoalProgress({ g }: { g: Weekly["goals"][number] }) {
  const gain = Math.max(g.pct - g.pctBefore, 0);
  return (
    <div>
      <div
        className="relative h-2.5 w-full rounded bg-slate-100"
        title={`${g.pct}% (trước tuần này ${g.pctBefore}%), nhịp đều cần ${g.expected}%`}
      >
        <div className="flex h-full overflow-hidden rounded">
          <div className="h-full bg-blue-700" style={{ width: `${g.pctBefore}%` }} />
          <div className="h-full bg-blue-300" style={{ width: `${gain}%` }} />
        </div>
        <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-600" style={{ left: `${g.expected}%` }} aria-hidden />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
        <span className="font-medium text-slate-800">{g.pct}%</span>
        <span>{gain > 0 ? `+${gain}% tuần này` : "tuần này chưa tiến"}</span>
        <span>nhịp đều cần {g.expected}%</span>
        <span>
          {g.unitsDone}/{g.units} việc · {g.done}/{g.total} điểm
        </span>
        {g.pace !== "du-dieu-kien" && g.units > 0 && (
          <span>{g.forecast ? `giữ nhịp này xong khoảng ${fmtDay(g.forecast)}` : "chưa có nhịp để dự báo"}</span>
        )}
      </div>
    </div>
  );
}
