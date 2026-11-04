import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { getCurrentProject, listProjects } from "@/lib/projects";
import { Avatar } from "./ui";
import { NavLinks } from "./nav-links";
import { ProjectSwitcher } from "./project-switcher";

export async function Sidebar() {
  // đọc cookie phiên trước khi truy vấn – lúc prerender, bước này dừng trang tĩnh trước khi chạm DB
  const me = await requireUser();
  const [project, projects] = await Promise.all([getCurrentProject(), listProjects()]);
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Task Board
      </div>
      <ProjectSwitcher
        current={{ code: project.code, name: project.name }}
        projects={projects.map((p) => ({ code: p.code, name: p.name }))}
      />
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
