"use client";

import { useFormAction } from "./use-form-action";
import { acceptInvite, login, setupAdmin, updateAccount, type FormState } from "@/app/actions/auth";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>
        {label}
      </label>
      <input id={props.name} className="input" {...props} />
    </div>
  );
}

function Message({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-700">{state.ok}</p>;
  return null;
}

export function LoginForm() {
  const [state, onSubmit, pending] = useFormAction(login, undefined, { loading: "Đang đăng nhập…", success: "Đã đăng nhập" });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
      <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <Message state={state} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

export function SetupForm() {
  const [state, onSubmit, pending] = useFormAction(setupAdmin, undefined, { loading: "Đang tạo tài khoản…", success: "Đã tạo tài khoản quản trị" });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Mã thiết lập (SETUP_SECRET)" name="secret" type="password" required autoFocus />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Tên hiển thị" name="name" required />
      <Field label="Mật khẩu (≥ 8 ký tự)" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Message state={state} />
      <button disabled={pending} className="btn-primary w-full">
        Tạo quản trị viên
      </button>
    </form>
  );
}

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [state, onSubmit, pending] = useFormAction(acceptInvite, undefined, { loading: "Đang tạo tài khoản…", success: "Chào mừng bạn!" });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Email" name="email_display" value={email} disabled readOnly />
      <Field label="Tên hiển thị" name="name" required autoFocus />
      <Field label="Mật khẩu (≥ 8 ký tự)" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Nhập lại mật khẩu" name="confirm" type="password" autoComplete="new-password" required />
      <Message state={state} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Đang lưu…" : "Đặt mật khẩu và vào"}
      </button>
    </form>
  );
}

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, onSubmit, pending] = useFormAction(updateAccount, undefined);
  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-4">
      <Field label="Email" name="email_display" value={email} disabled readOnly />
      <Field label="Tên hiển thị" name="name" defaultValue={name} required />
      <div className="border-t border-slate-200 pt-4 text-sm font-semibold">Đổi mật khẩu (để trống nếu không đổi)</div>
      <Field label="Mật khẩu hiện tại" name="current" type="password" autoComplete="current-password" />
      <Field label="Mật khẩu mới" name="password" type="password" autoComplete="new-password" />
      <Field label="Nhập lại mật khẩu mới" name="confirm" type="password" autoComplete="new-password" />
      <Message state={state} />
      <button disabled={pending} className="btn-primary">
        Lưu
      </button>
    </form>
  );
}
