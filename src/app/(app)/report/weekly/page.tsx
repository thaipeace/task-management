import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopySummary } from "@/components/copy-summary";
import { WeeklyEditor } from "@/components/goal-forms";
import { GoalProgress, PaceBadge } from "@/components/goal-ui";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/constants";
import { getCurrentProject } from "@/lib/projects";
import { GOAL_STATUSES, addDays, draftBody, fmtDay, getWeekly, listWeeklyReports, weekStartOf } from "@/lib/weekly";

export const metadata: Metadata = { title: "Báo cáo tuần" };

export default function WeeklyPage({ searchParams }: PageProps<"/report/weekly">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Loading />}>
        <WeeklyContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WeeklyContent({ searchParams }: Pick<PageProps<"/report/weekly">, "searchParams">) {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const sp = await searchParams;
  const raw = typeof sp.tuan === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) ? sp.tuan : today();
  const [w, saved] = await Promise.all([getWeekly(project.id, raw), listWeeklyReports(project.id)]);
  const thisWeek = weekStartOf(today());
  const range = `${fmtDay(w.weekStart)}–${fmtDay(w.weekEnd)}`;
  const body = w.report?.body ?? draftBody(w);
  const people = w.capacity.filter((c) => c.perWeek || c.thisWeek || w.plan.some((p) => p.assignee === c.name));

  return (
    <>
      <PageHeader
        title={`Báo cáo tuần · ${project.name}`}
        subtitle={`Tuần ${range}/${w.weekStart.slice(0, 4)}. So với mục tiêu đang theo; kế hoạch tuần tới xếp vừa sức làm thật của từng người.`}
        actions={<CopySummary text={`BÁO CÁO TUẦN ${range} – ${project.name}\n\n${body}\n`} />}
      />
      <ReportTabs />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/report/weekly?tuan=${addDays(w.weekStart, -7)}`} className="btn-secondary">
          ‹ Tuần trước
        </Link>
        {w.weekStart !== thisWeek && (
          <Link href="/report/weekly" className="btn-secondary">
            Tuần này
          </Link>
        )}
        {w.weekStart < thisWeek && (
          <Link href={`/report/weekly?tuan=${addDays(w.weekStart, 7)}`} className="btn-secondary">
            Tuần sau ›
          </Link>
        )}
        <Link href="/goals" className="btn-ghost ml-auto">
          Sửa mục tiêu →
        </Link>
      </div>

      <div className="space-y-6">
        <section className="card p-4 md:p-6">
          {w.report ? (
            <p className="mb-3 text-xs text-slate-500">
              {w.report.author ?? "Không rõ"} viết lúc{" "}
              {w.report.updatedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}.
              Số bên dưới là số hiện tại, có thể khác lúc viết.
            </p>
          ) : (
            <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Chưa có báo cáo cho tuần này. Claude viết vào thứ Bảy (<code>tm weekly</code> rồi <code>tm weekly-save</code>).
              Dưới đây là bản nháp tự động từ số liệu.
            </p>
          )}
          <RichText text={body} />
          <div className="mt-4">
            <WeeklyEditor
              projectId={project.id}
              week={w.weekStart}
              initial={body}
              label={w.report ? "Sửa báo cáo" : "Lưu bản nháp thành báo cáo"}
            />
          </div>
        </section>

        <section className="card p-4 md:p-5">
          <h2 className="font-semibold">Mục tiêu</h2>
          <p className="mb-3 text-xs text-slate-500">
            Đậm = xong trước tuần này, nhạt = xong trong tuần, vạch = tiến độ lẽ ra phải có nếu đi đều tới hạn.
          </p>
          {w.goals.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có mục tiêu.{" "}
              <Link href="/goals" className="text-brand underline">
                Đặt mục tiêu
              </Link>{" "}
              để báo cáo tuần có chuẩn so sánh.
            </p>
          ) : (
            <div className="space-y-4">
              {w.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900">{g.title}</span>
                    {g.status === "dang-theo" ? (
                      <PaceBadge pace={g.pace} />
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {GOAL_STATUSES.find((s) => s.value === g.status)?.label}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      hạn {fmtDay(g.dueOn)}
                      {g.owner ? ` · ${g.owner}` : ""}
                    </span>
                  </div>
                  <GoalProgress g={g} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4 md:p-5">
          <h2 className="font-semibold">
            Sức làm và kế hoạch tuần {fmtDay(w.nextWeekStart)}–{fmtDay(addDays(w.nextWeekStart, 6))}
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Sức làm = điểm cỡ việc (S 1 · M 2 · L 4) xong trung bình mỗi tuần trong 3 tuần trước. Việc đang làm dở luôn vào
            kế hoạch; sau đó lấy việc của mục tiêu đang chậm, P0, mục tiêu gần hạn – tới khi đầy sức. Việc bị chặn không
            xếp.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Người</th>
                  <th className="py-2 pr-3 text-right font-medium">Thường làm / tuần</th>
                  <th className="py-2 pr-3 text-right font-medium">Tuần này</th>
                  <th className="py-2 pr-3 text-right font-medium">Xếp tuần tới</th>
                  <th className="py-2 font-medium">Việc tuần tới</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((c) => (
                  <tr key={c.name} className="align-top">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{c.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.perWeek || "–"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.thisWeek}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${c.planned > c.plan ? "font-medium text-amber-800" : ""}`}>
                      {c.planned}/{c.plan}
                    </td>
                    <td className="py-2 text-xs text-slate-700">
                      {w.plan
                        .filter((p) => p.assignee === c.name)
                        .map((p) => (
                          <div key={p.key}>
                            <Link href={`/tasks/${p.key}`} className="font-semibold text-brand hover:underline">
                              {p.key}
                            </Link>{" "}
                            {p.title}
                            {p.goals.length > 0 && <span className="text-slate-500"> → {p.goals.join(", ")}</span>}
                          </div>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TaskList title="Cần người nhận" items={w.needOwner} />
          <TaskList title="Không vừa sức tuần tới (để sau hoặc thêm người)" items={w.overflow} />
          <TaskList title="Đang bị chặn" items={w.blocked} />
        </section>

        {saved.length > 0 && (
          <section className="text-xs text-slate-500">
            Báo cáo đã viết:{" "}
            {saved.map((s, i) => (
              <span key={s.weekStart}>
                {i > 0 && " · "}
                <Link href={`/report/weekly?tuan=${s.weekStart}`} className="text-brand hover:underline">
                  {fmtDay(s.weekStart)}
                </Link>
              </span>
            ))}
          </section>
        )}
      </div>
    </>
  );
}

function TaskList({ title, items }: { title: string; items: { key: string; title: string; reason?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-xs font-semibold text-slate-700">{title}</h3>
      <ul className="space-y-0.5 text-xs text-slate-700">
        {items.map((t) => (
          <li key={t.key}>
            <Link href={`/tasks/${t.key}`} className="font-semibold text-brand hover:underline">
              {t.key}
            </Link>{" "}
            {t.title}
            {t.reason && <span className="text-slate-500"> – {t.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
