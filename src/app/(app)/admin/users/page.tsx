import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteForm, ResetLinkButton, RevokeInviteButton, UserActions } from "@/components/admin-users";
import { Avatar, Loading, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAllUsers, listPendingInvites } from "@/lib/queries";

export const metadata: Metadata = { title: "Người dùng" };

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Người dùng" subtitle="Đăng nhập chỉ bằng link mời – không có đăng ký công khai." />
      <Suspense fallback={<Loading />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

async function UsersContent() {
  const me = await requireAdmin();
  const [users, invites] = await Promise.all([listAllUsers(), listPendingInvites()]);
  const fmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

  return (
    <div className="space-y-6">
      <InviteForm />

      {invites.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold">
            Link đang chờ ({invites.length})
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="font-medium">{i.email}</span>
                <span className="text-xs text-slate-500">
                  {users.some((u) => u.email === i.email)
                    ? "Đặt lại mật khẩu – mật khẩu cũ còn dùng được tới khi hoàn tất"
                    : i.role === "admin"
                      ? "Quản trị"
                      : "Thành viên"}
                </span>
                <span className="ml-auto text-xs text-slate-500">hết hạn {fmt.format(i.expiresAt)}</span>
                <RevokeInviteButton id={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold">
          Thành viên ({users.length})
        </h2>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${u.active ? "" : "opacity-50"}`}>
              <Avatar name={u.name} size={32} />
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-medium">
                  {u.name}
                  {!u.active && <span className="ml-2 text-xs font-normal text-red-600">đã khoá</span>}
                </div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  u.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {u.role === "admin" ? "Quản trị" : "Thành viên"}
              </span>
              {u.active && u.id !== me.id ? (
                <ResetLinkButton userId={u.id}>
                  <div className="ml-auto">
                    <UserActions userId={u.id} role={u.role} active={u.active} isSelf={false} />
                  </div>
                </ResetLinkButton>
              ) : (
                <div className="ml-auto">
                  <UserActions userId={u.id} role={u.role} active={u.active} isSelf={u.id === me.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
