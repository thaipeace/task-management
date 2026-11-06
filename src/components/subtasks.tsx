"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addSubtask, moveSubtask, setStatus } from "@/app/actions/tasks";
import { STATUSES, isDone } from "@/lib/constants";
import { Avatar, PriorityBadge } from "./ui";
import { useFormAction } from "./use-form-action";

type Sub = {
  key: string;
  title: string;
  status: string;
  priority: string;
  subOrder: number;
  assigneeName: string | null;
};

export function Subtasks({ parentKey, items: initial }: { parentKey: string; items: Sub[] }) {
  // thứ tự / trạng thái lạc quan – xong transition thì về dữ liệu máy chủ
  const [items, apply] = useOptimistic(initial, (list: Sub[], m: Partial<Sub> & { key: string }) =>
    list
      .map((s) => (s.key === m.key ? { ...s, ...m } : s))
      .sort((a, b) => a.subOrder - b.subOrder),
  );
  const [, startTransition] = useTransition();
  const dragRef = useRef<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [state, onSubmit, pending] = useFormAction(addSubtask.bind(null, parentKey), undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const done = items.filter((s) => isDone(s.status)).length;

  function indexFromPointer(e: React.DragEvent<HTMLElement>) {
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-sub]")].filter(
      (el) => el.dataset.sub !== dragRef.current,
    );
    const i = rows.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    return i === -1 ? rows.length : i;
  }

  function drop(index: number) {
    const key = dragRef.current;
    dragRef.current = null;
    setDragKey(null);
    setDropIndex(null);
    if (!key) return;
    const rest = items.filter((s) => s.key !== key);
    const before = rest[index - 1];
    const after = rest[index];
    const subOrder =
      before && after
        ? (before.subOrder + after.subOrder) / 2
        : before
          ? before.subOrder + 1000
          : after
            ? after.subOrder - 1000
            : 1000;
    if (items.find((s) => s.key === key)?.subOrder === subOrder) return;
    startTransition(async () => {
      apply({ key, subOrder });
      await moveSubtask(key, subOrder);
    });
  }

  const visible = items.filter((s) => s.key !== dragKey);

  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Việc con ({items.length})</h2>
        {items.length > 0 && (
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-28 overflow-hidden rounded bg-slate-200">
              <span
                className="block h-full bg-green-500"
                style={{ width: `${(done / items.length) * 100}%` }}
              />
            </span>
            {done}/{items.length} xong
          </span>
        )}
      </div>

      {items.length > 0 && (
        <ul
          onDragOver={(e) => {
            if (!dragRef.current) return;
            e.preventDefault();
            const i = indexFromPointer(e);
            if (i !== dropIndex) setDropIndex(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(indexFromPointer(e));
          }}
          className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white"
        >
          {items.map((s) => {
            const pos = visible.indexOf(s);
            return (
              <li
                key={s.key}
                data-sub={s.key}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", s.key);
                  dragRef.current = s.key;
                  setDragKey(s.key);
                }}
                onDragEnd={() => {
                  dragRef.current = null;
                  setDragKey(null);
                  setDropIndex(null);
                }}
                className={`relative flex items-center gap-2 px-2 py-1.5 text-sm ${
                  dragKey === s.key ? "opacity-40" : ""
                } ${dropIndex !== null && pos === dropIndex ? "border-t-2 border-t-brand" : ""}`}
              >
                <span title="Kéo để đổi thứ tự" className="cursor-grab px-1 text-slate-300 select-none">
                  ⋮⋮
                </span>
                <Link href={`/tasks/${s.key}`} className="min-w-16 shrink-0 text-xs font-semibold whitespace-nowrap text-brand hover:underline">
                  {s.key}
                </Link>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    isDone(s.status) ? "text-slate-400 line-through" : s.status === "huy" ? "text-slate-400" : ""
                  }`}
                >
                  {s.title}
                </span>
                <PriorityBadge priority={s.priority} />
                <select
                  value={s.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    startTransition(async () => {
                      apply({ key: s.key, status });
                      await setStatus(s.key, status);
                    });
                  }}
                  className="input w-28 py-0.5 text-xs"
                >
                  {STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <Avatar name={s.assigneeName} size={22} />
              </li>
            );
          })}
          {dropIndex !== null && dropIndex >= visible.length && <li className="h-0.5 bg-brand" />}
        </ul>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          onSubmit(e);
          // xoá ô nhập để thêm tiếp việc khác
          formRef.current?.reset();
        }}
        className="mt-2 flex gap-2"
      >
        <input name="title" required placeholder="Thêm việc con…" className="input" />
        <button disabled={pending} className="btn-secondary shrink-0">
          {pending ? "Đang thêm…" : "Thêm"}
        </button>
      </form>
      {state?.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
