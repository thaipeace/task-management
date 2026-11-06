"use client";

import { useActionState, useState } from "react";
import { useToastAction, withToast } from "./use-form-action";
import { createInvite, revokeInvite, setUserActive, setUserRole } from "@/app/actions/admin";

export function InviteForm() {
  const [state, action, pending] = useActionState(withToast(createInvite, { loading: "Đang tạo link mời…", success: "Đã tạo link mời" }), undefined);
  const [copied, setCopied] = useState(false);
  // token chỉ có sau khi bấm tạo (phía trình duyệt) nên đọc window ở đây an toàn
  const link = state?.token ? `${window.location.origin}/invite/${state.token}` : null;

  return (
    <div className="card p-4">
      <h2 className="mb-1 font-semibold">Mời người dùng</h2>
      <p className="mb-3 text-sm text-slate-500">
        Tạo link rồi gửi qua Zalo / Slack. Link dùng một lần, hết hạn sau 7 ngày. Mời lại email đã có
        = link đặt lại mật khẩu.
      </p>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="email@congty.com" className="input w-72" />
        <select name="role" defaultValue="member" className="input w-auto">
          <option value="member">Thành viên</option>
          <option value="admin">Quản trị</option>
        </select>
        <button disabled={pending} className="btn-primary">
          {pending ? "Đang tạo…" : "Tạo link mời"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {link && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3">
          <div className="mb-1 text-sm text-green-900">
            Link cho <b>{state?.email}</b> – chỉ hiện một lần, hãy copy ngay:
          </div>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.target.select()} className="input font-mono text-xs" />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="btn-secondary shrink-0"
            >
              {copied ? "Đã copy ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevokeInviteButton({ id }: { id: number }) {
  const [pending, run] = useToastAction();
  return (
    <button
      disabled={pending}
      onClick={() => run(() => revokeInvite(id), { loading: "Đang huỷ link…", success: "Đã huỷ link mời", error: "Không huỷ được link" })} className="btn-ghost text-xs text-red-700">
      Huỷ link
    </button>
  );
}

export function UserActions({
  userId,
  role,
  active,
  isSelf,
}: {
  userId: number;
  role: "admin" | "member";
  active: boolean;
  isSelf: boolean;
}) {
  const [pending, run] = useToastAction();
  if (isSelf) return <span className="text-xs text-slate-400">(bạn)</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value as "admin" | "member";
          run(() => setUserRole(userId, v), { loading: "Đang đổi vai trò…", success: v === "admin" ? "Đã đặt làm quản trị" : "Đã đặt làm thành viên", error: "Không đổi được vai trò" });
        }}
        className="input w-auto py-1 text-xs"
      >
        <option value="member">Thành viên</option>
        <option value="admin">Quản trị</option>
      </select>
      <button
        disabled={pending}
        onClick={() => {
          if (!active || confirm("Khoá tài khoản này? Người dùng bị đăng xuất ngay.")) {
            run(() => setUserActive(userId, !active), { loading: active ? "Đang khoá…" : "Đang mở khoá…", success: active ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản", error: "Không thực hiện được" });
          }
        }}
        className={active ? "btn-danger py-1 text-xs" : "btn-secondary py-1 text-xs"}
      >
        {active ? "Khoá" : "Mở khoá"}
      </button>
    </div>
  );
}
