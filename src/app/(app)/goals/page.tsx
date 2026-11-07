import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditableGoal, NewGoal } from "@/components/goal-forms";
import { GoalProgress, PaceBadge } from "@/components/goal-ui";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/constants";
import { getCurrentProject } from "@/lib/projects";
import { listActiveUsers, listSprints } from "@/lib/queries";
import { GOAL_STATUSES, addDays, fmtDay, getWeekly } from "@/lib/weekly";

export const metadata: Metadata = { title: "Mục tiêu" };

export default function GoalsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Mục tiêu"
        subtitle="Kết quả cần đạt trước một hạn. Báo cáo tuần lấy các mục tiêu đang theo làm chuẩn để đánh giá."
        actions={
          <Link href="/report/weekly" className="btn-secondary">
            Báo cáo tuần →
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <GoalsContent />
      </Suspense>
    </div>
  );
}

async function GoalsContent() {
  const [me, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const [w, users, sprints] = await Promise.all([
    getWeekly(project.id, today(), { allGoals: true }),
    listActiveUsers(),
    listSprints(project.id),
  ]);
  const now = today();
  const form = {
    projectId: project.id,
    users: users.map((u) => ({ id: u.id, name: u.name })),
    sprints: sprints.map((s) => ({ value: s.code, label: s.description ? `${s.code} – ${s.description}` : s.code })),
    statuses: GOAL_STATUSES,
    // mặc định một mục tiêu ~4 tuần: đủ dài để có kết quả, đủ ngắn để báo cáo tuần thấy lệch sớm
    defaults: { startOn: now, dueOn: addDays(now, 28) },
    canDelete: me.role === "admin",
  };
  // chỉ gửi xuống form đúng các trường sửa được
  const input = (g: (typeof w.goals)[number]) => ({
    id: g.id,
    title: g.title,
    measure: g.measure,
    ownerId: g.ownerId,
    startOn: g.startOn,
    dueOn: g.dueOn,
    sprint: g.sprint,
    taskKeys: g.taskKeys,
    status: g.status,
  });
  const active = w.goals.filter((g) => g.status === "dang-theo");
  const closed = w.goals.filter((g) => g.status !== "dang-theo");

  return (
    <div className="space-y-4">
      <details className="card p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-900">Đặt mục tiêu thế nào cho báo cáo tuần đo được?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>Một kết quả, không phải một việc</b>: “Khách thanh toán được trên web” thay vì “Làm trang thanh toán”.
          </li>
          <li>
            <b>Đạt khi</b>: điều kiện ai cũng kiểm được (số khách, không còn lỗi P0, đã lên production…). Hệ thống
            không tự đóng mục tiêu – xong hết việc chỉ là đủ điều kiện, người chịu trách nhiệm xác nhận Đạt.
          </li>
          <li>
            <b>Có hạn, 2–6 tuần</b>: báo cáo so tiến độ thật với nhịp đều từ ngày bắt đầu tới hạn, nên lệch sẽ lộ ra
            ngay tuần đầu.
          </li>
          <li>
            <b>Gắn việc</b>: chọn một đợt (mọi việc trong đợt) và / hoặc liệt kê id việc. Tiến độ = điểm việc xong / tổng
            điểm (S 1 · M 2 · L 4) – việc chưa ước lượng tính M, nên ước lượng càng đủ càng đúng.
          </li>
          <li>
            <b>Ít thôi</b>: 2–4 mục tiêu đang theo cùng lúc. Việc không thuộc mục tiêu nào vẫn làm, nhưng kế hoạch tuần
            ưu tiên việc của mục tiêu đang chậm.
          </li>
        </ul>
      </details>

      <NewGoal {...form} />

      {active.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">Chưa có mục tiêu nào đang theo.</div>
      )}
      {active.map((g) => (
        <EditableGoal key={g.id} {...form} goal={input(g)}>
          <div className="space-y-2 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-900">{g.title}</h2>
              <PaceBadge pace={g.pace} />
            </div>
            <div className="text-xs text-slate-500">
              {g.owner ?? "Chưa có người chịu trách nhiệm"} · {fmtDay(g.startOn)} → hạn {fmtDay(g.dueOn)}
              {g.daysLeft >= 0 ? ` (còn ${g.daysLeft} ngày)` : ` (quá ${-g.daysLeft} ngày)`}
              {g.sprint && (
                <>
                  {" "}
                  · đợt{" "}
                  <Link href={`/board?sprint=${encodeURIComponent(g.sprint)}`} className="text-brand hover:underline">
                    {g.sprint}
                  </Link>
                </>
              )}
              {g.taskKeys.length > 0 && <> · {g.taskKeys.join(", ")}</>}
            </div>
            <GoalProgress g={g} />
            {g.measure && (
              <div className="text-sm text-slate-700">
                <span className="font-medium">Đạt khi: </span>
                <RichText text={g.measure} inline />
              </div>
            )}
            {g.blocked.length > 0 && (
              <div className="text-xs text-amber-800">
                <span aria-hidden>⚠ </span>
                Vướng: {g.blocked.map((b) => `${b.key} chờ ${b.by}`).join(", ")}
              </div>
            )}
          </div>
        </EditableGoal>
      ))}

      {closed.length > 0 && (
        <>
          <h2 className="pt-4 text-sm font-semibold text-slate-500">Đã đóng</h2>
          {closed.map((g) => (
            <EditableGoal key={g.id} {...form} goal={input(g)}>
              <div className="flex flex-wrap items-center gap-2 pr-12 text-sm">
                <span className="font-medium text-slate-700">{g.title}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {GOAL_STATUSES.find((s) => s.value === g.status)?.label}
                </span>
                <span className="text-xs text-slate-500">
                  hạn {fmtDay(g.dueOn)} · {g.pct}% · {g.unitsDone}/{g.units} việc
                </span>
              </div>
            </EditableGoal>
          ))}
        </>
      )}
    </div>
  );
}
