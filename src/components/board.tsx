"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { moveTask } from "@/app/actions/tasks";
import { STATUSES } from "@/lib/constants";
import type { TaskRow } from "@/lib/queries";
import { AreaBadge, Avatar, PriorityBadge, SubtaskProgress, TypeIcon } from "./ui";

type Move = { key: string; status: string; position: number };

export function Board({ tasks: initial }: { tasks: TaskRow[] }) {
  // bản lạc quan chỉ sống trong transition – xong (hoặc lỗi) thì về lại dữ liệu máy chủ
  const [tasks, applyMove] = useOptimistic(initial, (ts: TaskRow[], m: Move) =>
    ts.map((t) => (t.key === m.key ? { ...t, status: m.status, position: m.position } : t)),
  );
  const [dragKey, setDragKeyState] = useState<string | null>(null);
  // sự kiện dragover có thể tới trước khi state kịp render lại – handler đọc ref
  const dragRef = useRef<string | null>(null);
  const setDragKey = (k: string | null) => {
    dragRef.current = k;
    setDragKeyState(k);
  };
  const [drop, setDrop] = useState<{ status: string; index: number } | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const columns = STATUSES.filter((s) => showCancelled || s.value !== "huy");
  const byStatus = (status: string) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  function onDrop(status: string, index: number) {
    const key = dragRef.current;
    setDragKey(null);
    setDrop(null);
    if (!key) return;
    const moving = tasks.find((t) => t.key === key);
    if (!moving) return;

    const list = byStatus(status).filter((t) => t.key !== key);
    const before = list[index - 1];
    const after = list[index];
    const position =
      before && after
        ? (before.position + after.position) / 2
        : before
          ? before.position + 1000
          : after
            ? after.position - 1000
            : 1000;
    if (moving.status === status && moving.position === position) return;

    startTransition(async () => {
      applyMove({ key, status, position });
      try {
        await moveTask(key, status, position);
        setError(null);
      } catch {
        setError(`Không chuyển được ${key} – đã hoàn lại`);
      }
    });
  }

  function indexFromPointer(e: React.DragEvent<HTMLDivElement>) {
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-card]")].filter(
      (el) => el.dataset.card !== dragRef.current,
    );
    const i = cards.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    return i === -1 ? cards.length : i;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-3 text-xs text-slate-500">
        {error && <span className="text-red-600">{error}</span>}
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          Hiện cột Huỷ
        </label>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = byStatus(col.value);
          const isTarget = drop?.status === col.value;
          return (
            <div
              key={col.value}
              data-column={col.value}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault();
                const index = indexFromPointer(e);
                if (drop?.status !== col.value || drop.index !== index) {
                  setDrop({ status: col.value, index });
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col.value, indexFromPointer(e));
              }}
              className={`flex w-72 shrink-0 flex-col rounded-lg border-t-4 p-2 transition-shadow ${col.column} ${col.accent} ${
                isTarget ? "ring-2 ring-brand/40" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1.5 pt-1 pb-2">
                <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  {col.label}
                </span>
                <span className={`rounded-full px-2 text-xs font-semibold ${col.count}`}>{items.length}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {items.map((t, i) => (
                  <div key={t.key}>
                    {isTarget && drop.index === i && dragKey !== t.key && <DropLine />}
                    <Card
                      task={t}
                      dragging={dragKey === t.key}
                      onDragStart={() => setDragKey(t.key)}
                      onDragEnd={() => {
                        setDragKey(null);
                        setDrop(null);
                      }}
                    />
                  </div>
                ))}
                {isTarget && drop.index >= items.filter((t) => t.key !== dragKey).length && (
                  <DropLine />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DropLine() {
  return <div className="mb-2 h-1 rounded bg-brand" />;
}

function Card({
  task: t,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <Link
      href={`/tasks/${t.key}`}
      data-card={t.key}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.key);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`block rounded-md border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${
        dragging ? "opacity-40" : ""
      } ${t.status === "xong" || t.status === "huy" ? "opacity-70" : ""}`}
    >
      {t.parentKey && (
        <div
          title={`Việc con của ${t.parentKey}${t.parentTitle ? ` · ${t.parentTitle}` : ""}`}
          className="mb-1 truncate text-[11px] text-slate-500"
        >
          ↳ <span className="font-semibold">{t.parentKey}</span>
          {t.parentTitle && <span> · {t.parentTitle}</span>}
        </div>
      )}
      <div
        className={`text-sm leading-snug text-slate-800 ${t.status === "huy" ? "line-through" : ""}`}
      >
        {t.title}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {t.sprint && (
          <span className="max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {t.sprint}
          </span>
        )}
        {t.needsApproval && (
          <span
            title="Cần phê duyệt"
            className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700"
          >
            Cần duyệt
          </span>
        )}
        <SubtaskProgress done={t.subDone} total={t.subTotal} />
        {t.dependsOn.length > 0 && (
          <span
            title={`Phụ thuộc: ${t.dependsOn.join(", ")}`}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
          >
            ⛓ {t.dependsOn.length}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <TypeIcon type={t.type} />
        <span className="text-xs font-semibold text-slate-500">{t.key}</span>
        <AreaBadge area={t.area} />
        <span className="ml-auto flex items-center gap-1.5">
          {t.estimate && (
            <span className="rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-600">
              {t.estimate}
            </span>
          )}
          <PriorityBadge priority={t.priority} />
          <Avatar name={t.assigneeName} size={22} />
        </span>
      </div>
    </Link>
  );
}
