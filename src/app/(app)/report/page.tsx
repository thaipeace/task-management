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
          {r.lead.rows.length > 0 && <Lead l={r.lead} />}

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

function Workload({ w }: { w: Report["workload"] }) {
  const max = Math.max(w.avg * 1.5, ...w.rows.map((p) => p.load), w.unassigned.load, 1);
  const bar = (load: number, label: string) => (
    <div className="relative h-3 w-full rounded bg-slate-100" title={label}>
      <div className="h-full rounded bg-blue-600" style={{ width: `${(load / max) * 100}%` }} />
      {w.avg > 0 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500"
          style={{ left: `${(w.avg / max) * 100}%` }}
          aria-hidden
        />
      )}
    </div>
  );
  return (
    <section className="card p-4 md:p-5">
      <h2 className="font-semibold">Khối lượng theo người</h2>
      <p className="mb-3 text-xs text-slate-500">
        Cân theo độ nặng, không chỉ đếm việc. Điểm = cỡ việc (S 1 · M 2 · L 4, chưa ước lượng tính M) × ưu tiên (P0 ×2 ·
        P1 ×1,5 · P2 ×1 · P3 ×0,5); việc chờ duyệt / đang kiểm tra tính nửa điểm. Vạch xám = trung bình {fmt(w.avg)}{" "}
        điểm mỗi người.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Người</th>
              <th className="w-[28%] py-2 pr-3 font-medium">Đang giữ (điểm)</th>
              <th className="py-2 pr-3 text-right font-medium">Việc mở</th>
              <th className="py-2 pr-3 text-right font-medium">Gấp</th>
              <th className="py-2 pr-3 text-right font-medium">Đang làm</th>
              <th className="py-2 pr-3 text-right font-medium">Chờ duyệt / KT</th>
              <th className="py-2 pr-3 text-right font-medium">Xong 14 ngày</th>
              <th className="py-2 font-medium">Trách nhiệm quyết định</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {w.rows.map((p) => (
              <tr key={p.name} className="align-top">
                <td className="py-2 pr-3 font-medium whitespace-nowrap text-slate-900">{p.name}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {bar(p.load, `${p.name}: ${fmt(p.load)} điểm (${fmt(p.share)}× trung bình)`)}
                    <span className="w-10 shrink-0 text-right tabular-nums">{fmt(p.load)}</span>
                  </div>
                  {p.flags.map((f) => (
                    <div key={f} className="mt-1 text-xs font-medium text-amber-800">
                      <span aria-hidden>⚠ </span>
                      {f}
                    </div>
                  ))}
                  {p.unestimated > 0 && (
                    <div className="mt-1 text-xs text-slate-500">{p.unestimated} việc chưa ước lượng (tính như M)</div>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.openCount}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {p.urgent || "–"}
                  {p.p0 > 0 && <span className="block text-xs text-red-700">{p.p0} P0</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.doing || "–"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.waiting || "–"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {p.doneRecent ? (
                    <>
                      {p.doneRecent}
                      <span className="block text-xs text-slate-500">{fmt(p.doneRecentPoints)} điểm</span>
                    </>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="py-2 text-xs text-slate-600">
                  {[...p.decisions, ...p.approvals.map((k) => `duyệt ${k}`)].join(", ") || "–"}
                </td>
              </tr>
            ))}
            {w.unassigned.count > 0 && (
              <tr className="align-top text-slate-600">
                <td className="py-2 pr-3 italic">Chưa giao</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {bar(w.unassigned.load, `Chưa giao: ${fmt(w.unassigned.load)} điểm`)}
                    <span className="w-10 shrink-0 text-right tabular-nums">{fmt(w.unassigned.load)}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{w.unassigned.count}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{w.unassigned.urgent || "–"}</td>
                <td colSpan={4} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Công việc dẫn dắt: mỗi ô = số việc (không phải số lượt) người đó tác động theo từng loại, trên việc không giao cho họ
function Lead({ l }: { l: Report["lead"] }) {
  const max = Math.max(1, ...l.rows.flatMap((r) => LEAD_KINDS.map((k) => r.kinds[k.key].tasks)));
  // thang một sắc xanh: càng nhiều việc càng đậm
  const tone = (n: number) =>
    !n ? "text-slate-400" : n / max > 0.66 ? "bg-blue-600 text-white" : n / max > 0.33 ? "bg-blue-200 text-blue-950" : "bg-blue-50 text-blue-900";
  return (
    <section className="card p-4 md:p-5">
      <h2 className="font-semibold">Công việc dẫn dắt (14 ngày)</h2>
      <p className="mb-3 text-xs text-slate-500">
        Phần việc không nằm trong việc được giao: lập việc, chuẩn hoá, giao, kiểm tra, chốt, hướng dẫn. Mỗi ô là số việc đã tác
        động (rê chuột xem số lượt), chỉ tính việc giao cho người khác hoặc chưa giao, lấy từ nhật ký và bình luận – gồm cả thao
        tác agent làm bằng tài khoản của người đó.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Người</th>
              {LEAD_KINDS.map((k) => (
                <th key={k.key} className="px-1 py-2 text-center font-medium" title={k.hint}>
                  {k.label}
                </th>
              ))}
              <th className="py-2 pl-3 text-right font-medium">Việc đã chạm</th>
              <th className="py-2 pl-3 font-medium">Đòn bẩy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {l.rows.map((r) => (
              <tr key={r.name} className="align-middle">
                <td className="py-2 pr-3 font-medium whitespace-nowrap text-slate-900">{r.name}</td>
                {LEAD_KINDS.map((k) => {
                  const c = r.kinds[k.key];
                  return (
                    <td key={k.key} className="px-1 py-1.5 text-center">
                      <span
                        className={`inline-block min-w-10 rounded px-2 py-1 tabular-nums ${tone(c.tasks)}`}
                        title={`${r.name} · ${k.label}: ${c.tasks} việc, ${c.actions} lượt`}
                      >
                        {c.tasks || "–"}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right tabular-nums">
                  {r.touched}
                  <span className="block text-xs text-slate-500">{r.others} của người khác</span>
                </td>
                <td className="py-2 pl-3 text-xs text-slate-600">
                  {r.othersDone ? (
                    <>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {r.signedDone}/{r.othersDone}
                      </span>{" "}
                      việc người khác làm xong có kiểm hoặc chốt ({pct(r.signedDone, r.othersDone)}%)
                    </>
                  ) : (
                    "–"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
