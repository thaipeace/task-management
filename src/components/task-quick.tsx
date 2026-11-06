"use client";

import { useState, useTransition } from "react";
import { useToastAction } from "./use-form-action";
import { toast } from "@/lib/toast";
import { assignTask, deleteComment, setStatus, updateComment } from "@/app/actions/tasks";
import { STATUSES } from "@/lib/constants";
import { MarkdownField } from "./markdown-field";

export function StatusSelect({ taskKey, status }: { taskKey: string; status: string }) {
  const [pending, run] = useToastAction();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        const label = STATUSES.find((s) => s.value === v)?.label ?? v;
        run(() => setStatus(taskKey, v), {
          loading: "Đang đổi trạng thái…",
          success: `${taskKey} → ${label}`,
          error: "Không đổi được trạng thái",
        });
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
  const [pending, run] = useToastAction();
  return (
    <select
      defaultValue={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        const name = users.find((u) => u.id === Number(v))?.name;
        run(() => assignTask(taskKey, v ? Number(v) : null), {
          loading: "Đang giao việc…",
          success: name ? `Đã giao ${taskKey} cho ${name}` : `${taskKey} chưa giao cho ai`,
          error: "Không giao được việc",
        });
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
  const [pending, run] = useToastAction();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Xoá bình luận này?"))
          run(() => deleteComment(id), { loading: "Đang xoá bình luận…", success: "Đã xoá bình luận", error: "Không xoá được bình luận" });
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
          const ok = await toast.run(() => updateComment(id, text), {
            loading: "Đang lưu bình luận…",
            success: "Đã sửa bình luận",
            error: "Không lưu được bình luận",
          });
          if (ok) setEditing(false);
        });
      }}
      className="mt-1"
    >
      <MarkdownField name="body" defaultValue={body} rows={4} required autoFocus onEscape={() => setEditing(false)} />
      <div className="mt-1 flex items-center gap-2">
        <button disabled={pending} className="btn-primary py-1 text-xs">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-1 text-xs">
          Huỷ
        </button>
      </div>
    </form>
  );
}
