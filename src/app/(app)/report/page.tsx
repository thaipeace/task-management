import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Burnup, OpenHeatmap, ReleaseProgress } from "@/components/charts";
import { CopySummary } from "@/components/copy-summary";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PRIORITIES, STATUSES, today } from "@/lib/constants";
import { getCurrentProject } from "@/lib/projects";
import { LEAD_KINDS, PROGRESS, buildSummary, fmt, getReport, summaryText, type Report } from "@/lib/report";

export const metadata: Metadata = { title: "Báo cáo" };

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<Loading />}>
        <ReportContent />
      </Suspense>
    </div>
  );
}

async function ReportContent() {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const r = await getReport(project.id);
  const date = today();
  const sections = buildSummary(r, project.name);
  const T = r.totals;
  const progressStatuses = STATUSES.filter((s) => (PROGRESS as readonly string[]).includes(s.value));

  return (
    <>
      <PageHeader
        title={`Báo cáo · ${project.name}`}
        subtitle={`Tình hình đến ngày ${date.split("-").reverse().join("/")}. Đếm theo đơn vị công việc: việc con và việc không chia nhỏ (việc cha đã chia nhỏ chỉ là nhóm).`}
        actions={<CopySummary text={summaryText(sections, project.name, date.split("-").reverse().join("/"))} />}
      />
      <ReportTabs />

      {T.all === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Dự án chưa có việc nào.{" "}
          <Link href="/tasks/new" className="text-brand underline">
            Tạo việc
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Tổng việc" value={T.all} note={T.cancelled ? `+${T.cancelled} đã huỷ` : undefined} />
            <Stat label="Đã xong" value={`${pct(T.done, T.all)}%`} note={`${T.done}/${T.all} việc${T.released ? ` · ${T.released} đã release` : ""}`} />
            <Stat label="Đang làm" value={T.inProgress} note={[T.review && `+${T.review} chờ duyệt`, T.testing && `+${T.testing} đang kiểm tra`].filter(Boolean).join(" · ") || "chưa có việc chờ duyệt"} />
            <Stat
              label="Ưu tiên cao chưa xong"
              value={T.highOpen}
              note={T.p0Open ? `${T.p0Open} việc chặn phát hành` : "không có P0"}
              alert={T.p0Open > 0}
            />
            <Stat label="Chờ quyết định" value={r.decisions.length} note={[T.blocked && `${T.blocked} việc cần thêm thông tin`, `${T.risks} rủi ro đã chấp nhận`].filter(Boolean).join(" · ")} />
          </div>

          <section className="card p-4 md:p-5">
            <h2 className="font-semibold">Tiến độ theo đợt phát hành</h2>
            <p className="mb-3 text-xs text-slate-500">Mỗi thanh là một đợt; màu càng đậm càng gần xong. Rê chuột để xem số việc.</p>
            <ReleaseProgress
              releases={r.releases.map((x) => ({
                code: x.code ?? "Chưa xếp đợt",
                description: x.description,
                total: x.total,
                done: x.done,
                pct: x.pct,
                byStatus: x.byStatus,
              }))}
              statuses={progressStatuses.map((s) => ({ value: s.value, label: s.label }))}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <section className="card p-4 md:p-5">
              <h2 className="font-semibold">Việc theo thời gian</h2>
              <p className="mb-3 text-xs text-slate-500">
                Tổng việc đã nhận so với số đã xong, cộng dồn theo ngày. Khoảng cách giữa hai đường là phần còn phải làm.
              </p>
              <Burnup points={r.timeline} />
            </section>
            <section className="card p-4 md:p-5">
              <h2 className="font-semibold">Việc chưa xong theo mảng và ưu tiên</h2>
              <p className="mb-3 text-xs text-slate-500">Mảng nào đang dồn việc gấp.</p>
              {r.matrix.length ? (
                <OpenHeatmap rows={r.matrix} priorities={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
              ) : (
                <p className="text-sm text-slate-500">Không còn việc nào chưa xong.</p>
              )}
            </section>
          </div>

          {r.workload.rows.length > 0 && <Workload w={r.workload} />}

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-semibold">Tóm tắt cho quản lý</h2>
            <p className="mb-4 text-xs text-slate-500">
              Viết bằng lời thường, đọc không cần biết kỹ thuật. Nút “Sao chép tóm tắt” lấy nguyên phần này để gửi qua Zalo / email.
            </p>
            <div className="space-y-5">
              {sections.map((s) => (
                <div key={s.title}>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">{s.title}</h3>
                  {s.intro && <p className="text-sm leading-relaxed text-slate-800">{s.intro}</p>}
                  {s.lines.length > 0 && (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                      {s.lines.map((l, i) => (
                        <li key={i}>
                          <RichText text={l} inline />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// Màu theo bảng phân loại đã kiểm (validate_palette: 6 ô, đạt CVD); 3 màu nhạt dưới 3:1 nên luôn kèm chú giải + số
const SEG: Record<"exec" | (typeof LEAD_KINDS)[number]["key"], string> = {
  exec: "#2a78d6",
  plan: "#eb6834",
  assign: "#1baf7a",
  verify: "#eda100",
  decide: "#e87ba4",
  guide: "#008300",
};

function Workload({ w }: { w: Report["workload"] }) {
  const max = Math.max(w.avg * 1.25, ...w.rows.map((p) => p.units), 1);
  const series = [
    { key: "exec" as const, label: "Thực hiện", hint: "việc được giao: đang giữ + xong trong 14 ngày" },
    ...LEAD_KINDS.map((k) => ({ key: k.key, label: k.label, hint: k.hint })),
  ];
  const value = (p: Report["workload"]["rows"][number], key: (typeof series)[number]["key"]) =>
    key === "exec" ? p.exec : p.kinds[key].tasks;
  return (
    <section className="card p-4 md:p-5">
      <h2 className="font-semibold">Khối lượng theo người</h2>
      <p className="mb-3 text-xs text-slate-500">
        14 ngày gần nhất, đơn vị là đầu việc: việc được giao (đang giữ + đã xong) cộng việc quản lý trên việc của người khác,
        tính theo từng loại – một việc vừa giao vừa kiểm tính 2. Lấy từ nhật ký và bình luận, gồm cả thao tác agent làm bằng
        tài khoản của người đó. Vạch xám = trung bình {fmt(w.avg)}.
      </p>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Chú giải">
        {series.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5" title={s.hint}>
            <span className="size-2.5 rounded-sm" style={{ background: SEG[s.key] }} aria-hidden />
            {s.label}
            {i === 0 && <span className="text-slate-300">|</span>}
          </li>
        ))}
      </ul>
      <div className="space-y-4">
        {w.rows.map((p) => (
          <div key={p.name} className="grid gap-x-4 gap-y-1 md:grid-cols-[9rem_1fr_6rem]">
            <div className="font-medium text-slate-900">{p.name}</div>
            <div>
              <div className="relative">
                <div className="flex h-3.5 gap-[2px]" role="img" aria-label={`${p.name}: ${p.units} đầu việc`}>
                  {series.map((s) => {
                    const n = value(p, s.key);
                    if (!n) return null;
                    return (
                      <div
                        key={s.key}
                        className="h-full rounded-[3px] transition-opacity hover:opacity-80"
                        style={{ width: `${(n / max) * 100}%`, background: SEG[s.key] }}
                        title={`${p.name} · ${s.label}: ${n} việc${s.key === "exec" ? "" : ` (${p.kinds[s.key].actions} lượt)`}`}
                      />
                    );
                  })}
                </div>
                {w.avg > 0 && (
                  <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500" style={{ left: `${(w.avg / max) * 100}%` }} aria-hidden />
                )}
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                <div>
                  <span className="font-medium text-slate-800">Thực hiện {p.exec}:</span>{" "}
                  {[
                    p.openCount ? `giữ ${p.openCount} việc (${fmt(p.load)} điểm nặng)` : "không giữ việc nào",
                    p.urgent ? `${p.urgent} gấp${p.p0 ? `, ${p.p0} P0` : ""}` : "",
                    p.waiting ? `${p.waiting} chờ duyệt / KT` : "",
                    `xong ${p.doneRecent}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {p.managed > 0 && (
                  <div>
                    <span className="font-medium text-slate-800">Quản lý {p.managed}:</span>{" "}
                    {[
                      `${p.others} việc của người khác`,
                      p.othersDone ? `${p.signedDone}/${p.othersDone} việc người khác làm xong có kiểm hoặc chốt` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {p.decisions.length + p.approvals.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-800">Giữ quyết định:</span>{" "}
                    {[...p.decisions, ...p.approvals.map((k) => `duyệt ${k}`)].join(", ")}
                  </div>
                )}
                {p.flags.map((f) => (
                  <div key={f} className="font-medium text-amber-800">
                    <span aria-hidden>⚠ </span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right md:order-none">
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{p.units}</span>
              <span className="block text-xs text-slate-500">{w.avg ? `${fmt(p.share)}× trung bình` : "đầu việc"}</span>
            </div>
          </div>
        ))}
      </div>
      {w.unassigned.count > 0 && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Chưa giao:</span> {w.unassigned.count} việc, {fmt(w.unassigned.load)} điểm
          nặng{w.unassigned.urgent ? `, ${w.unassigned.urgent} việc gấp` : ""}.
        </p>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-slate-500">Bảng số liệu</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1.5 pr-3 font-medium">Người</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1.5 pr-3 text-right font-medium" title={s.hint}>
                    {s.label}
                  </th>
                ))}
                <th className="py-1.5 text-right font-medium">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {w.rows.map((p) => (
                <tr key={p.name}>
                  <td className="py-1.5 pr-3 font-medium text-slate-800">{p.name}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 pr-3 text-right tabular-nums">
                      {value(p, s.key) || "–"}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-semibold tabular-nums">{p.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  alert,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {note && (
        <div className={`mt-0.5 text-xs ${alert ? "font-medium text-red-700" : "text-slate-500"}`}>
          {alert && <span aria-hidden>⚠ </span>}
          {note}
        </div>
      )}
    </div>
  );
}
