"use client";

import { useState, useTransition } from "react";
import { assignTask, deleteComment, setStatus, updateComment } from "@/app/actions/tasks";
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

export function CommentBody({
  id,
  body,
  canEdit,
  children,
}: {
  id: number;
  body: string;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="group">
        {children}
        {canEdit && (
          <button onClick={() => setEditing(true)} className="mt-0.5 text-xs text-slate-400 hover:text-brand">
            Sửa
          </button>
        )}
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("body") ?? "");
        start(async () => {
          try {
            await updateComment(id, text);
            setEditing(false);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không lưu được");
          }
        });
      }}
      className="mt-1"
    >
      <textarea
        name="body"
        defaultValue={body}
        rows={3}
        required
        autoFocus
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="input"
      />
      <div className="mt-1 flex items-center gap-2">
        <button disabled={pending} className="btn-primary py-1 text-xs">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-1 text-xs">
          Huỷ
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
