"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "./use-form-action";
import { deleteRecord, deleteSprint, saveRecord, saveSprint, type TaskFormState } from "@/app/actions/tasks";

function Msg({ state }: { state: TaskFormState }) {
  if (state?.error) return <span className="text-sm text-red-600">{state.error}</span>;
  if (state?.ok) return <span className="text-sm text-green-700">{state.ok}</span>;
  return null;
}

export function SprintForm({
  projectId,
  sprint,
  canDelete,
}: {
  projectId: number;
  sprint?: { code: string; description: string };
  canDelete?: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction(
    saveSprint.bind(null, projectId, sprint?.code ?? null),
    undefined,
  );
  const [deleting, startDelete] = useTransition();
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        name="code"
        defaultValue={sprint?.code}
        required
        placeholder="D5-ten-dot"
        className="input w-56 font-mono text-xs"
      />
      <input
        name="description"
        defaultValue={sprint?.description}
        placeholder="Mục tiêu của đợt"
        className="input min-w-64 flex-1"
      />
      <button disabled={pending} className={sprint ? "btn-secondary" : "btn-primary"}>
        {sprint ? "Lưu" : "+ Thêm đợt"}
      </button>
      {sprint && canDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (confirm(`Xoá đợt ${sprint.code}? Các việc trong đợt chuyển về "Chưa xếp đợt".`)) {
              startDelete(() => deleteSprint(projectId, sprint.code));
            }
          }}
          className="btn-danger"
        >
          Xoá
        </button>
      )}
      <Msg state={state} />
    </form>
  );
}

type RecordData = Record<string, unknown>;

export function RecordForm({
  projectId,
  kind,
  recordKey,
  data,
  canDelete,
  onDone,
}: {
  projectId: number;
  kind: "risk" | "decision";
  recordKey: string | null;
  data?: RecordData;
  canDelete?: boolean;
  onDone?: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (s: TaskFormState, f: FormData) => {
      const r = await saveRecord(projectId, kind, recordKey, s, f);
      if (r?.ok) onDone?.();
      return r;
    },
    undefined,
  );
  const [deleting, startDelete] = useTransition();
  const str = (k: string) => (data?.[k] == null ? "" : String(data[k]));
  const field = (name: string, label: string, rows = 2) => (
    <div>
      <label className="label">{label}</label>
      <textarea name={name} defaultValue={str(name)} rows={rows} className="input" />
    </div>
  );
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {kind === "risk" ? (
        <>
          <div>
            <label className="label">Tiêu đề</label>
            <input name="tieu_de" defaultValue={str("tieu_de")} required className="input" />
          </div>
          {field("nguon", "Nguồn", 1)}
          {field("danh_gia", "Đánh giá", 4)}
          {field("xem_lai_khi", "Xem lại khi", 2)}
        </>
      ) : (
        <>
          {field("cau_hoi", "Câu hỏi", 4)}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Ai quyết</label>
              <input name="ai" defaultValue={str("ai")} className="input" />
            </div>
            <div>
              <label className="label">Chặn việc</label>
              <input
                name="chan_viec"
                defaultValue={Array.isArray(data?.chan_viec) ? (data.chan_viec as string[]).join(", ") : ""}
                placeholder="BE-009, BE-013"
                className="input"
              />
            </div>
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        <button disabled={pending} className="btn-primary">
          {recordKey ? "Lưu" : "Thêm"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-secondary">
            Huỷ
          </button>
        )}
        {recordKey && canDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`Xoá ${recordKey}?`)) startDelete(() => deleteRecord(recordKey));
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

export function EditableRecord({
  projectId,
  kind,
  recordKey,
  data,
  canDelete,
  children,
}: {
  projectId: number;
  kind: "risk" | "decision";
  recordKey: string;
  data: RecordData;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div id={recordKey} className="card scroll-mt-6 p-4 target:ring-2 target:ring-brand">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
          {recordKey}
        </span>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost ml-auto text-xs">
            Sửa
          </button>
        )}
      </div>
      {editing ? (
        <RecordForm
          projectId={projectId}
          kind={kind}
          recordKey={recordKey}
          data={data}
          canDelete={canDelete}
          onDone={() => setEditing(false)}
        />
      ) : (
        children
      )}
    </div>
  );
}

export function NewRecord({
  projectId,
  kind,
  label,
}: {
  projectId: number;
  kind: "risk" | "decision";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        + {label}
      </button>
    );
  }
  return (
    <div className="card p-4">
      <RecordForm projectId={projectId} kind={kind} recordKey={null} onDone={() => setOpen(false)} />
    </div>
  );
}
