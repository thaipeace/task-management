"use client";

import { startTransition, useActionState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { errorMessage, toast } from "@/lib/toast";

export type ToastMsgs = { loading?: string; success?: string } | false;

// Bọc action kiểu useActionState bằng toast: đang thực hiện → thành công (state.ok) / thất bại (state.error).
export function withToast<S, A extends unknown[]>(
  action: (state: Awaited<S>, ...args: A) => Promise<S>,
  msgs: ToastMsgs = {},
) {
  return async (prev: Awaited<S>, ...args: A): Promise<S> => {
    if (msgs === false) return action(prev, ...args);
    const id = toast.loading(msgs.loading ?? "Đang lưu…");
    try {
      const next = await action(prev, ...args);
      const st = next as { error?: string; ok?: string } | undefined;
      if (st?.error) toast.error(st.error, { id });
      else toast.success(st?.ok ?? msgs.success ?? "Đã lưu", { id });
      return next;
    } catch (e) {
      if (isRedirectError(e)) toast.success(msgs.success ?? "Đã lưu", { id });
      else toast.error(errorMessage(e, "Không lưu được, thử lại sau"), { id });
      throw e;
    }
  };
}

// Như useActionState nhưng gửi qua onSubmit: React không tự reset form sau action,
// nên khi lỗi người dùng không mất những gì đã nhập. Kèm toast (msgs = false để tắt).
export function useFormAction<S>(
  action: (state: Awaited<S>, form: FormData) => Promise<S>,
  initial: Awaited<S>,
  msgs: ToastMsgs = {},
) {
  const [state, formAction, pending] = useActionState<S, FormData>(withToast(action, msgs), initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => formAction(form));
  };
  return [state, onSubmit, pending] as const;
}

// Nút / ô chọn gọi action trực tiếp: run(promise, câu chữ) chạy trong transition kèm toast
export function useToastAction() {
  const [pending, start] = useTransition();
  const run = (work: () => Promise<unknown>, msgs: Parameters<typeof toast.run>[1], then?: () => void) =>
    start(async () => {
      if ((await toast.run(work, msgs)) && then) then();
    });
  return [pending, run] as const;
}
