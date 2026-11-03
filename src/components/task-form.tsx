"use client";

import Link from "next/link";
import { useFormAction } from "./use-form-action";
import type { TaskFormState } from "@/app/actions/tasks";
import type { Task } from "@/db/schema";
import { AREAS, ESTIMATES, PRIORITIES, STATUSES, TYPES } from "@/lib/constants";

type Props = {
  action: (state: TaskFormState, form: FormData) => Promise<TaskFormState>;
  task?: Task;
  sprints: { code: string; description: string }[];
  users: { id: number; name: string }[];
  defaultSprint?: string;
  cancelHref: string;
};

export function TaskForm({ action, task: t, sprints, users, defaultSprint, cancelHref }: Props) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);

  const select = (
    name: string,
    label: string,
    options: readonly { value: string; label: string }[],
    value: string | null | undefined,
    empty?: string,
  ) => (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={value ?? ""} className="input">
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const area = (name: string, label: string, value: string, rows = 4, hint?: string) => (
    <div>
      <label className="label">
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">{hint}</span>}
      </label>
      <textarea name={name} defaultValue={value} rows={rows} className="input font-[inherit]" />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div>
          <label className="label">Tiêu đề</label>
          <input
            name="title"
            defaultValue={t?.title}
            required
            autoFocus={!t}
            placeholder="Một dòng, nói kết quả cần đạt"
            className="input text-base"
          />
        </div>
        {area("description", "Mô tả", t?.description ?? "", 6, "vấn đề + vì sao quan trọng")}
        {area("steps", "Việc cần làm", (t?.steps ?? []).join("\n"), 5, "mỗi dòng một bước")}
        {area("doneCriteria", "Tiêu chí xong", (t?.doneCriteria ?? []).join("\n"), 4, "mỗi dòng một tiêu chí")}
        {area("evidence", "Bằng chứng", (t?.evidence ?? []).join("\n"), 4, "mỗi dòng một tệp:dòng")}
        {area("tests", "Kiểm thử", (t?.tests ?? []).join("\n"), 3, "mỗi dòng một bài")}
        {area("risk", "Rủi ro", t?.risk ?? "", 3)}
        <fieldset className="card space-y-3 p-4">
          <legend className="px-1 text-sm font-semibold">Liên quan</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Issue</label>
              <input name="relIssue" defaultValue={t?.related.issue ?? ""} className="input" />
            </div>
            <div>
              <label className="label">PR</label>
              <input name="relPr" defaultValue={t?.related.pr ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Việc liên quan</label>
            <input
              name="relTasks"
              defaultValue={(t?.related.viec ?? []).join(", ")}
              placeholder="BE-002, FE-001"
              className="input"
            />
          </div>
          {area("relDocs", "Tài liệu", (t?.related.tai_lieu ?? []).join("\n"), 2, "mỗi dòng một tài liệu")}
        </fieldset>
      </div>

      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          {select("status", "Trạng thái", STATUSES, t?.status ?? "moi")}
          {select("priority", "Ưu tiên", PRIORITIES, t?.priority ?? "P2")}
          {select("area", t ? "Mảng (id giữ nguyên)" : "Mảng (quyết định tiền tố id)", AREAS, t?.area ?? "BE")}
          {select("type", "Loại", TYPES, t?.type ?? "loi")}
          {select(
            "sprint",
            "Đợt",
            sprints.map((s) => ({ value: s.code, label: s.code })),
            t ? t.sprint : defaultSprint,
            "— Chưa xếp đợt —",
          )}
          {select("estimate", "Ước lượng", ESTIMATES, t?.estimate, "— Chưa ước lượng —")}
          {select(
            "assigneeId",
            "Người làm",
            users.map((u) => ({ value: String(u.id), label: u.name })),
            t?.assigneeId ? String(t.assigneeId) : "",
            "— Chưa giao —",
          )}
        </div>
        <div className="card space-y-3 p-4">
          <div>
            <label className="label">Phụ thuộc</label>
            <input
              name="dependsOn"
              defaultValue={(t?.dependsOn ?? []).join(", ")}
              placeholder="id việc phải xong trước"
              className="input"
            />
          </div>
          <div>
            <label className="label">Nhánh gợi ý</label>
            <input
              name="branch"
              defaultValue={t?.branch ?? ""}
              placeholder="bug/… feat/… chore/…"
              className="input font-mono text-xs"
            />
          </div>
          <div>
            <label className="label">Nguồn</label>
            <input name="source" defaultValue={t?.source ?? ""} className="input" />
          </div>
        </div>
        <div className="card space-y-3 p-4">
          <div className="text-sm font-semibold">Cần phê duyệt</div>
          <div>
            <label className="label">Ai duyệt</label>
            <input name="approvalWho" defaultValue={t?.approval?.ai ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Lý do</label>
            <textarea name="approvalWhy" defaultValue={t?.approval?.ly_do ?? ""} rows={2} className="input" />
          </div>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1">
            {pending ? "Đang lưu…" : t ? "Lưu" : "Tạo việc"}
          </button>
          <Link href={cancelHref} className="btn-secondary">
            {state?.ok ? "Xem" : "Huỷ"}
          </Link>
        </div>
      </aside>
    </form>
  );
}
