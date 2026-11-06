"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  createProject,
  deleteProject,
  switchProject,
  updateProject,
  type ProjectFormState,
} from "@/app/actions/projects";
import { useFormAction } from "./use-form-action";
import { errorMessage, toast } from "@/lib/toast";

export function NewProjectForm() {
  const [code, setCode] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // chỉ xoá ô nhập khi tạo xong – lỗi thì giữ nguyên để sửa
  const [state, onSubmit, pending] = useFormAction(async (s: ProjectFormState, f: FormData) => {
    const r = await createProject(s, f);
    if (r?.ok) {
      formRef.current?.reset();
      setCode("");
    }
    return r;
  }, undefined);
  return (
    <div className="card p-4">
      <h2 className="mb-1 font-semibold">Thêm dự án</h2>
      <p className="mb-3 text-sm text-slate-500">
        Mã dự án đứng trước id việc của dự án đó và không đổi được sau khi tạo.
      </p>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="grid gap-2 sm:grid-cols-[140px_1fr]"
      >
        <input
          name="code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          maxLength={10}
          placeholder="Mã (vd. ABC)"
          className="input font-mono uppercase"
        />
        <input name="name" required placeholder="Tên dự án" className="input" />
        <textarea
          name="description"
          rows={2}
          placeholder="Mô tả ngắn (không bắt buộc)"
          className="input sm:col-span-2"
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={pending} className="btn-primary">
            {pending ? "Đang tạo…" : "+ Tạo dự án"}
          </button>
          {code && (
            <span className="text-xs text-slate-500">
              Id việc sẽ là <code className="rounded bg-slate-100 px-1">{code}-001</code>,{" "}
              <code className="rounded bg-slate-100 px-1">{code}-002</code>…
            </span>
          )}
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        </div>
      </form>
    </div>
  );
}

type Row = { id: number; code: string; name: string; description: string; keyPrefix: string };

export function ProjectRow({
  project: p,
  stats,
  isCurrent,
  canDelete,
}: {
  project: Row;
  stats: { tasks: number; open: number; sprints: number };
  isCurrent: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, onSubmit, saving] = useFormAction(updateProject.bind(null, p.id), undefined);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-sm font-semibold text-brand">{p.code}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-medium">
            {p.name}
            {isCurrent && <span className="ml-2 text-xs font-normal text-green-700">đang xem</span>}
          </div>
          <div className="text-xs text-slate-500">
            {stats.tasks} việc ({stats.open} chưa xong) · {stats.sprints} đợt · id việc:{" "}
            <code>{p.code}-001</code>
          </div>
        </div>
        {!isCurrent && (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await toast.run(() => switchProject(p.code), { loading: "Đang chuyển dự án…", success: `Đang xem ${p.name}`, error: "Không chuyển được dự án" }))
                  router.push("/board");
              })
            }
            className="btn-secondary py-1 text-xs"
          >
            Mở bảng
          </button>
        )}
        <button onClick={() => setEditing((v) => !v)} className="btn-ghost py-1 text-xs">
          {editing ? "Đóng" : "Sửa"}
        </button>
        {canDelete && (
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm(`Xoá dự án ${p.code}? (chỉ xoá được khi chưa có việc)`)) return;
              start(async () => {
                try {
                  await deleteProject(p.id);
                  toast.success(`Đã xoá dự án ${p.code}`);
                } catch (e) {
                  const m = errorMessage(e, "Không xoá được – dự án còn việc hoặc là dự án duy nhất");
                  setError(m);
                  toast.error(m);
                }
              });
            }}
            className="btn-danger py-1 text-xs"
          >
            Xoá
          </button>
        )}
      </div>
      {p.description && !editing && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {editing && (
        <form onSubmit={onSubmit} className="mt-3 grid gap-2">
          <input name="name" required defaultValue={p.name} className="input" />
          <textarea name="description" rows={2} defaultValue={p.description} placeholder="Mô tả" className="input" />
          <div className="flex items-center gap-2">
            <button disabled={saving} className="btn-primary py-1 text-xs">
              Lưu
            </button>
            {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
            {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
          </div>
        </form>
      )}
    </li>
  );
}
