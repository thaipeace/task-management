"use client";

import { useSyncExternalStore } from "react";
import { getServerToasts, getToasts, subscribe, toast, type ToastKind } from "@/lib/toast";

const STYLE: Record<ToastKind, { box: string; icon: React.ReactNode; label: string }> = {
  loading: {
    box: "border-slate-300",
    icon: <span className="block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />,
    label: "Đang thực hiện",
  },
  success: { box: "border-green-500", icon: <span className="text-green-600">✓</span>, label: "Thành công" },
  error: { box: "border-red-500", icon: <span className="text-red-600">!</span>, label: "Thất bại" },
  info: { box: "border-sky-500", icon: <span className="text-sky-600">i</span>, label: "Thông báo" },
};

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getToasts, getServerToasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            data-toast={t.kind}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border border-l-4 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-lg ${s.box}`}
          >
            <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-sm font-bold">
              {s.icon}
            </span>
            <span className="sr-only">{s.label}: </span>
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            {t.kind !== "loading" && (
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="-mr-1 shrink-0 rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
