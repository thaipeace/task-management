"use client";

import { startTransition, useActionState } from "react";

// Như useActionState nhưng gửi qua onSubmit: React không tự reset form sau action,
// nên khi lỗi người dùng không mất những gì đã nhập.
export function useFormAction<S>(
  action: (state: Awaited<S>, form: FormData) => Promise<S>,
  initial: Awaited<S>,
) {
  const [state, formAction, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => formAction(form));
  };
  return [state, onSubmit, pending] as const;
}
