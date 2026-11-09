import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Quên mật khẩu</h1>
      <p className="mb-5 text-sm text-slate-500">Nhập email tài khoản, chúng tôi sẽ gửi link đặt mật khẩu mới.</p>
      <ForgotPasswordForm />
    </>
  );
}
