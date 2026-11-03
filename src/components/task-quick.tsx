"use client";

import { useTransition } from "react";
import { assignTask, deleteComment, setStatus } from "@/app/actions/tasks";
import { STATUSES } from "@/lib/constants";

export function StatusSelect({ taskKey, status }: { taskKey: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => setStatus(taskKey, v));
      }}
      className="input font-semibold"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function AssigneeSelect({
  taskKey,
  assigneeId,
  users,
}: {
  taskKey: string;
  assigneeId: number | null;
  users: { id: number; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => assignTask(taskKey, v ? Number(v) : null));
      }}
      className="input"
    >
      <option value="">— Chưa giao —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

export function DeleteCommentButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Xoá bình luận này?")) start(() => deleteComment(id));
      }}
      className="text-xs text-slate-400 hover:text-red-600"
    >
      Xoá
    </button>
  );
}
