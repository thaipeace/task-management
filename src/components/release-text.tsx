"use client";

import { useState, useTransition } from "react";
import { saveReleaseText } from "@/app/actions/releases";
import { toast } from "@/lib/toast";
import { MarkdownField } from "./markdown-field";

// Admin sửa Nhận xét chung / Ghi chú thêm của bản release ngay trên trang
export function ReleaseTextEditor({
  project,
  version,
  field,
  initial,
  children,
}: {
  project: string;
  version: string;
  field: "body" | "notes";
  initial: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();
  if (!editing) {
    return (
      <div>
        {children}
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-slate-500 hover:text-brand">
          Sửa
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("text") ?? "");
        start(async () => {
          const id = toast.loading("Đang lưu…", { delay: 0 });
          try {
            const r = await saveReleaseText(project, version, field, text);
            if (r.error) return void toast.error(r.error, { id });
            toast.success(r.ok ?? "Đã lưu", { id });
            setEditing(false);
          } catch {
            toast.error("Không lưu được – thử lại", { id });
          }
        });
      }}
    >
      <MarkdownField name="text" defaultValue={initial} rows={12} required={field === "body"} autoFocus onEscape={() => setEditing(false)} />
      <div className="mt-2 flex gap-2">
        <button disabled={busy} className="btn-primary py-1 text-xs">
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-1 text-xs">
          Huỷ
        </button>
      </div>
    </form>
  );
}
