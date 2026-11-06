"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";

// Thông báo nổi (toast) dùng chung: gọi từ bất kỳ component client nào, <Toaster /> hiển thị.
// Ba trạng thái: đang thực hiện → thành công / thất bại, cập nhật tại chỗ trên cùng một toast.

export type ToastKind = "loading" | "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; message: string };

const DURATION: Record<ToastKind, number | null> = { loading: null, success: 3000, info: 4000, error: 7000 };
// việc xong nhanh hơn chừng này thì không hiện "đang thực hiện" (tránh chớp)
const LOADING_DELAY = 300;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const getToasts = () => toasts;
const EMPTY: Toast[] = [];
export const getServerToasts = () => EMPTY;

function clearTimer(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

function dismiss(id: number) {
  clearTimer(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function show(kind: ToastKind, message: string, opts: { id?: number; delay?: number } = {}) {
  const id = opts.id ?? nextId++;
  clearTimer(id);
  const put = () => {
    const t = { id, kind, message };
    toasts = toasts.some((x) => x.id === id) ? toasts.map((x) => (x.id === id ? t : x)) : [...toasts.slice(-4), t];
    emit();
    const ms = DURATION[kind];
    if (ms) timers.set(id, setTimeout(() => dismiss(id), ms));
  };
  if (opts.delay) timers.set(id, setTimeout(put, opts.delay));
  else put();
  return id;
}

// Lỗi ném từ server action: bản production giấu nội dung – khi đó dùng câu dự phòng.
// Lỗi mạng (fetch hỏng) thì nói rõ là mất kết nối.
export function errorMessage(e: unknown, fallback: string) {
  if (e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return `${fallback} – không kết nối được máy chủ, kiểm tra mạng rồi thử lại`;
  }
  const m = e instanceof Error ? e.message : "";
  return m && !/omitted in production|Server Components render/i.test(m) ? m : fallback;
}

export type RunMessages = { loading?: string; success?: string; error?: string };

export const toast = {
  success: (message: string, opts?: { id?: number }) => show("success", message, opts),
  error: (message: string, opts?: { id?: number }) => show("error", message, opts),
  info: (message: string, opts?: { id?: number }) => show("info", message, opts),
  loading: (message: string, opts?: { id?: number; delay?: number }) => show("loading", message, { delay: LOADING_DELAY, ...opts }),
  dismiss,
  // Chạy một action kèm toast; trả về true nếu thành công (redirect cũng tính là thành công)
  async run(work: Promise<unknown> | (() => Promise<unknown>), msgs: RunMessages = {}): Promise<boolean> {
    const id = toast.loading(msgs.loading ?? "Đang thực hiện…");
    try {
      await (typeof work === "function" ? work() : work);
      toast.success(msgs.success ?? "Đã xong", { id });
      return true;
    } catch (e) {
      if (isRedirectError(e)) {
        toast.success(msgs.success ?? "Đã xong", { id });
        throw e;
      }
      toast.error(errorMessage(e, msgs.error ?? "Không thực hiện được, thử lại sau"), { id });
      return false;
    }
  },
};
