import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { Avatar } from "./ui";
import { NavLinks } from "./nav-links";

export async function Sidebar() {
  const me = await requireUser();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
          TB
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Task Board</div>
          <div className="text-xs text-slate-500">Backlog kỹ thuật</div>
        </div>
      </div>
      <NavLinks isAdmin={me.role === "admin"} />
      <div className="mt-auto hidden border-t border-slate-200 p-3 md:block">
        <a href="/account" className="flex items-center gap-2 rounded-md p-1.5 hover:bg-slate-100">
          <Avatar name={me.name} size={28} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">{me.name}</div>
            <div className="truncate text-xs text-slate-500">{me.email}</div>
          </div>
        </a>
        <form action={logout}>
          <button className="btn-ghost mt-1 w-full justify-start text-xs">Đăng xuất</button>
        </form>
      </div>
    </aside>
  );
}
