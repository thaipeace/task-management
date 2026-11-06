"use client";

import { useTransition } from "react";
import { toast } from "@/lib/toast";

// Form gửi server action (không trả state) kèm toast; thành công thì xoá trắng form, lỗi thì giữ chữ đã nhập
export function ToastForm({
  action,
  loading,
  success,
  error,
  className,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  loading: string;
  success: string;
  error: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [, start] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const form = new FormData(el);
        start(async () => {
          if (await toast.run(() => action(form), { loading, success, error })) el.reset();
        });
      }}
    >
      {children}
    </form>
  );
}
