import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Burnup, OpenHeatmap, ReleaseProgress } from "@/components/charts";
import { CopySummary } from "@/components/copy-summary";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PRIORITIES, STATUSES, today } from "@/lib/constants";
import { getCurrentProject } from "@/lib/projects";
import { PROGRESS, buildSummary, getReport, summaryText } from "@/lib/report";

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
            <Stat label="Đang làm" value={T.inProgress} note={T.review ? `+${T.review} chờ duyệt` : "chưa có việc chờ duyệt"} />
            <Stat
              label="Ưu tiên cao chưa xong"
              value={T.highOpen}
              note={T.p0Open ? `${T.p0Open} việc chặn phát hành` : "không có P0"}
              alert={T.p0Open > 0}
            />
            <Stat label="Chờ quyết định" value={r.decisions.length} note={`${T.risks} rủi ro đã chấp nhận`} />
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
