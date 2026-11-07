"use client";

import { useState, useTransition } from "react";
import { deleteGoal, saveGoal, saveWeekly } from "@/app/actions/goals";
import type { TaskFormState } from "@/app/actions/tasks";
import { toast } from "@/lib/toast";
import { MarkdownField, MarkdownHint } from "./markdown-field";
import { useFormAction } from "./use-form-action";

export type GoalInput = {
  id: number;
  title: string;
  measure: string;
  ownerId: number | null;
  startOn: string;
  dueOn: string;
  sprint: string | null;
  taskKeys: string[];
  status: string;
};

type Opt = { value: string; label: string };

function Msg({ state }: { state: TaskFormState }) {
  if (state?.error) return <span className="text-sm text-red-600">{state.error}</span>;
  return null;
}

export function GoalForm({
  projectId,
  goal,
  users,
  sprints,
  statuses,
  defaults,
  canDelete,
  onDone,
}: {
  projectId: number;
  goal?: GoalInput;
  users: { id: number; name: string }[];
  sprints: Opt[];
  statuses: readonly Opt[];
  defaults: { startOn: string; dueOn: string };
  canDelete?: boolean;
  onDone?: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (s: TaskFormState, f: FormData) => {
      const r = await saveGoal(projectId, goal?.id ?? null, s, f);
      if (r?.ok) onDone?.();
      return r;
    },
    undefined,
    { loading: "Đang lưu mục tiêu…", success: "Đã lưu mục tiêu" },
  );
  const [deleting, startDelete] = useTransition();
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Mục tiêu – kết quả cần đạt</label>
        <input
          name="title"
          defaultValue={goal?.title}
          required
          placeholder="VD: Khách đăng ký và thanh toán được trên kid.siroby.com"
          className="input"
        />
      </div>
      <div>
        <label className="label flex items-baseline gap-2">
          Đạt khi – điều kiện kiểm chứng được <MarkdownHint />
        </label>
        <MarkdownField
          name="measure"
          defaultValue={goal?.measure}
          rows={2}
          placeholder="VD: 3 khách thật thanh toán thành công; không còn lỗi P0 mở"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Người chịu trách nhiệm</label>
          <select name="ownerId" defaultValue={goal?.ownerId ?? ""} className="input">
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bắt đầu</label>
          <input type="date" name="startOn" required defaultValue={goal?.startOn ?? defaults.startOn} className="input" />
        </div>
        <div>
          <label className="label">Hạn</label>
          <input type="date" name="dueOn" required defaultValue={goal?.dueOn ?? defaults.dueOn} className="input" />
        </div>
        <div>
          <label className="label">Trạng thái</label>
          <select name="status" defaultValue={goal?.status ?? "dang-theo"} className="input">
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="label">Gắn đợt (mọi việc trong đợt)</label>
          <select name="sprint" defaultValue={goal?.sprint ?? ""} className="input">
            <option value="">— không —</option>
            {sprints.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Và / hoặc các việc cụ thể (việc cha tính cả việc con)</label>
          <input
            name="taskKeys"
            defaultValue={goal?.taskKeys.join(", ")}
            placeholder="SIA-009, SIA-014"
            className="input font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={pending} className="btn-primary">
          {goal ? "Lưu" : "Thêm mục tiêu"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-secondary">
            Huỷ
          </button>
        )}
        {goal && canDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Xoá mục tiêu "${goal.title}"? Báo cáo tuần đã viết vẫn giữ.`)) return;
              startDelete(async () => {
                await toast.run(() => deleteGoal(goal.id), {
                  loading: "Đang xoá…",
                  success: "Đã xoá mục tiêu",
                  error: "Không xoá được mục tiêu",
                });
              });
            }}
            className="btn-danger ml-auto"
          >
            Xoá
          </button>
        )}
        <Msg state={state} />
      </div>
    </form>
  );
}

// Thẻ mục tiêu: xem / bấm Sửa để mở form ngay tại chỗ
export function EditableGoal({
  children,
  ...form
}: Omit<Parameters<typeof GoalForm>[0], "onDone"> & { goal: GoalInput; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="card p-4">
      {editing ? (
        <GoalForm {...form} onDone={() => setEditing(false)} />
      ) : (
        <div className="relative">
          <button onClick={() => setEditing(true)} className="btn-ghost absolute top-0 right-0 text-xs">
            Sửa
          </button>
          {children}
        </div>
      )}
    </div>
  );
}

export function NewGoal(props: Omit<Parameters<typeof GoalForm>[0], "onDone" | "goal">) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm mục tiêu
      </button>
    );
  }
  return (
    <div className="card p-4">
      <GoalForm {...props} onDone={() => setOpen(false)} />
    </div>
  );
}

export function WeeklyEditor({
  projectId,
  week,
  initial,
  label,
}: {
  projectId: number;
  week: string;
  initial: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction(
    async (s: TaskFormState, f: FormData) => {
      const r = await saveWeekly(projectId, week, s, f);
      if (r?.ok) setOpen(false);
      return r;
    },
    undefined,
    { loading: "Đang lưu báo cáo…", success: "Đã lưu báo cáo tuần" },
  );
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        {label}
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="card w-full space-y-3 p-4">
      <MarkdownField name="body" defaultValue={initial} rows={18} />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="btn-primary">
          Lưu báo cáo
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Huỷ
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}
