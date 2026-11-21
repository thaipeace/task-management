"use client";

import { useState, useTransition } from "react";
import { approveRelease } from "@/app/actions/releases";
import { toast } from "@/lib/toast";
import { MarkdownField } from "./markdown-field";

// Nút Duyệt: mở hộp ghi nhận xét duyệt (bắt buộc) – phản hồi của sếp, quyết định, điều chỉnh, link tài liệu.
// Nhận xét lưu thành bình luận "Nhận xét duyệt" trên trang bản release.
export function ApproveRelease({ project, version, pending }: { project: string; version: string; pending: number }) {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0 px-2.5 py-1 text-xs">
        Duyệt
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]" onClick={() => !busy && setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const comment = String(new FormData(e.currentTarget).get("comment") ?? "");
              startTransition(async () => {
                const id = toast.loading(`Đang duyệt ${version}…`, { delay: 0 });
                try {
                  const r = await approveRelease(project, version, comment);
                  if (r.error) return void toast.error(r.error, { id });
                  toast.success(r.ok ?? "Đã duyệt", { id });
                  setOpen(false);
                } catch {
                  toast.error(`Không duyệt được ${version} – thử lại`, { id });
                }
              });
            }}
            className="card w-full max-w-2xl space-y-3 p-5 text-left"
          >
            <h2 className="text-base font-semibold">Duyệt {version}</h2>
            <p className="text-sm text-slate-600">
              Đã release xong: {pending} việc đang Xong trên Dev sẽ chuyển sang Released. Ghi lại phản hồi khi duyệt – điều chỉnh,
              quyết định, hướng đi quan trọng, link tài liệu sếp gửi – để lưu cùng bản release.
            </p>
            <MarkdownField
              name="comment"
              rows={8}
              required
              autoFocus
              placeholder="Vd. Sếp đồng ý release. Điều chỉnh: … Quyết định: … Tài liệu: [biên bản](https://…)"
              onEscape={() => !busy && setOpen(false)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn-ghost">
                Huỷ
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Đang duyệt…" : "Duyệt và lưu nhận xét"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
