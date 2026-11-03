"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importAction } from "@/app/actions/admin";

export function ImportForm() {
  const [state, action, pending] = useActionState(importAction, undefined);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (mode === "replace" && !confirm("Thay toàn bộ: xoá mọi việc, bình luận, nhật ký, đợt, AR/QD rồi nạp lại từ tệp. Tiếp tục?")) {
          e.preventDefault();
        }
      }}
      className="card space-y-4 p-4"
    >
      <div>
        <label className="label">Tệp backlog.json</label>
        <input
          name="file"
          type="file"
          accept=".json,application/json"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
      </div>
      <fieldset className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="radio" name="mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-1" />
          <span>
            <b>Gộp</b> – thêm việc mới, cập nhật việc trùng id theo tệp. Giữ người làm, bình luận và dòng nhật ký
            đã ghi trong app.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1" />
          <span>
            <b className="text-red-700">Thay toàn bộ</b> – xoá dữ liệu backlog hiện có rồi nạp lại từ tệp (người dùng giữ nguyên).
          </span>
        </label>
      </fieldset>
      <button disabled={pending} className="btn-primary">
        {pending ? "Đang import…" : "Import"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.summary && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Đã import {state.summary.tasks} việc ({state.summary.created} mới, {state.summary.updated} cập nhật),{" "}
          {state.summary.sprints} đợt, {state.summary.risks} AR, {state.summary.decisions} QD,{" "}
          {state.summary.logs} dòng nhật ký.{" "}
          <Link href="/board" className="font-semibold underline">
            Mở bảng →
          </Link>
        </div>
      )}
    </form>
  );
}
