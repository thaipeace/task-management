"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Cập nhật gần thời gian thực bằng hỏi định kỳ: mỗi 2 phút (chỉ khi tab đang mở) và ngay khi quay lại tab.
// Đang gõ dở trong form, đang kéo thẻ → không tự refresh, chỉ hiện dải báo để người dùng tự bấm.
const INTERVAL = 120_000;
const MIN_GAP = 15_000;

// Có ô nào trong form đã sửa khác giá trị ban đầu không
function hasUnsavedInput() {
  return [...document.querySelectorAll<HTMLElement>("main form [name]")].some((el) => {
    if (el.closest("[data-live-ignore]")) return false;
    if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
    if (el instanceof HTMLSelectElement) return [...el.options].some((o) => o.selected !== o.defaultSelected);
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden") return false;
      if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
      return el.value !== el.defaultValue;
    }
    return false;
  });
}

export function LiveRefresh() {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const version = useRef<string | null>(null);
  const lastCheck = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    async function check() {
      if (document.hidden || Date.now() - lastCheck.current < MIN_GAP) return;
      lastCheck.current = Date.now();
      let v: string;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        v = (await res.json()).v;
      } catch {
        return; // mất mạng – lần sau hỏi lại
      }
      const prev = version.current;
      version.current = v;
      if (prev === null || prev === v) return;
      if (dragging.current || hasUnsavedInput()) setStale(true);
      else {
        setStale(false);
        router.refresh();
      }
    }
    const onVisible = () => {
      if (!document.hidden) check();
    };
    const onDragStart = () => (dragging.current = true);
    const onDragEnd = () => (dragging.current = false);
    // đóng tab / tải lại khi còn chữ chưa lưu → trình duyệt hỏi lại
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedInput()) e.preventDefault();
    };

    check();
    const timer = setInterval(check, INTERVAL);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [router]);

  if (!stale) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-lg">
      Có thay đổi mới từ người khác. Chữ bạn đang soạn vẫn giữ nguyên.
      <button
        type="button"
        onClick={() => {
          setStale(false);
          router.refresh();
        }}
        className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Cập nhật
      </button>
      <button type="button" onClick={() => setStale(false)} className="text-xs text-amber-700 hover:underline">
        Để sau
      </button>
    </div>
  );
}
