"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/board", label: "Bảng", icon: "▦" },
  { href: "/backlog", label: "Backlog", icon: "☰" },
  { href: "/sprints", label: "Đợt", icon: "◷" },
  { href: "/goals", label: "Mục tiêu", icon: "◎" },
  { href: "/records", label: "Rủi ro & quyết định", icon: "⚑" },
  { href: "/report", label: "Báo cáo", icon: "◔" },
];
const ADMIN = [
  { href: "/admin/projects", label: "Dự án", icon: "◫" },
  { href: "/admin/users", label: "Người dùng", icon: "👥" },
  { href: "/admin/import", label: "Import / Export", icon: "⇅" },
];
const MOBILE_ONLY = [{ href: "/account", label: "Tài khoản", icon: "◉" }];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const item = (l: { href: string; label: string; icon: string }, extra = "") => {
    const active = pathname === l.href || pathname.startsWith(l.href + "/");
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-1.5 text-sm ${extra} ${
          active ? "bg-blue-50 font-semibold text-brand" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span className="w-4 text-center text-slate-400">{l.icon}</span>
        {l.label}
      </Link>
    );
  };
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
      {MAIN.map((l) => item(l))}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase md:block">
            Quản trị
          </div>
          {ADMIN.map((l) => item(l))}
        </>
      )}
      {MOBILE_ONLY.map((l) => item(l, "md:hidden"))}
      <Link href="/tasks/new" className="btn-primary mt-3 hidden md:mx-1 md:flex">
        + Tạo việc
      </Link>
    </nav>
  );
}
