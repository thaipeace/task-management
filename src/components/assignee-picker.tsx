"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { assignTask } from "@/app/actions/tasks";
import { toast } from "@/lib/toast";
import { Avatar } from "./ui";

export type PickerUser = { id: number; name: string };

// Bấm avatar trên thẻ / dòng việc để giao hoặc giao lại ngay tại danh sách.
// Danh sách chọn gắn vào body (position: fixed) để không bị khung cuộn / overflow-hidden cắt mất.
export function AssigneePicker({
  taskKey,
  assigneeId,
  assigneeName,
  users,
  size = 22,
}: {
  taskKey: string;
  assigneeId: number | null;
  assigneeName: string | null;
  users: PickerUser[];
  size?: number;
}) {
  const [current, setOptimistic] = useOptimistic({ id: assigneeId, name: assigneeName });
  const [pending, start] = useTransition();
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "mousedown" && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return;
      setPos(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    // gần đáy màn hình thì mở lên trên
    setPos(window.innerHeight - r.bottom < 260 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  }

  function pick(id: number | null) {
    setPos(null);
    if (id === current.id) return;
    const name = id ? (users.find((u) => u.id === id)?.name ?? null) : null;
    start(async () => {
      setOptimistic({ id, name });
      await toast.run(() => assignTask(taskKey, id), {
        loading: "Đang giao việc…",
        success: name ? `Đã giao ${taskKey} cho ${name}` : `${taskKey} chưa giao cho ai`,
        error: `Không giao được ${taskKey}`,
      });
    });
  }

  const option = (id: number | null, label: string) => (
    <button
      key={id ?? "none"}
      type="button"
      role="menuitemradio"
      aria-checked={current.id === id}
      onClick={() => pick(id)}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${current.id === id ? "font-semibold" : ""}`}
    >
      <Avatar name={id ? label : null} size={20} />
      <span className="flex-1 truncate">{label}</span>
      {current.id === id && <span className="text-brand">✓</span>}
    </button>
  );

  return (
    <>
      <button
        ref={btn}
        type="button"
        draggable={false}
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={current.name ? `Người làm: ${current.name} – bấm để giao lại` : "Chưa giao – bấm để giao việc"}
        title={current.name ? `${current.name} – bấm để giao lại` : "Bấm để giao việc"}
        className={`relative z-10 shrink-0 rounded-full ring-brand/40 transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none ${pending ? "opacity-50" : ""}`}
      >
        <Avatar name={current.name} size={size} />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            data-assignee-menu={taskKey}
            style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="z-50 max-h-64 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Giao {taskKey} cho</div>
            {option(null, "Chưa giao")}
            {users.map((u) => option(u.id, u.name))}
          </div>,
          document.body,
        )}
    </>
  );
}
