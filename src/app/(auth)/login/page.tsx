import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Đăng nhập</h1>
      <p className="mb-5 text-sm text-slate-500">Chưa có tài khoản? Xin quản trị viên một link mời.</p>
      <LoginForm />
    </>
  );
}
