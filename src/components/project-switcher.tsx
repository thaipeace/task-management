"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchProject } from "@/app/actions/projects";

type P = { code: string; name: string };

// Trang danh sách thì ở lại (lọc theo dự án mới); trang chi tiết việc thì về bảng
const LIST_PAGES = ["/board", "/backlog", "/sprints", "/records", "/report", "/admin/import", "/tasks/new"];

export function ProjectSwitcher({ current, projects }: { current: P; projects: P[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: string) => {
    setOpen(false);
    if (code === current.code) return;
    start(async () => {
      await switchProject(code);
      // bộ lọc (đợt, người làm…) của dự án cũ không còn nghĩa
      router.replace(LIST_PAGES.includes(pathname) ? pathname : "/board");
    });
  };

  return (
    <div ref={ref} className="relative px-2 pb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-white">
          {current.code.slice(0, 3)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{current.name}</span>
          <span className="block text-xs text-slate-500">{pending ? "Đang chuyển…" : `Dự án ${current.code}`}</span>
        </span>
        <span className="text-[10px] text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute inset-x-2 z-30 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {projects.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => pick(p.code)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                p.code === current.code ? "font-semibold text-brand" : ""
              }`}
            >
              <span className="w-12 shrink-0 font-mono text-xs text-slate-500">{p.code}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Liên kết sang trang danh sách của một dự án cụ thể (vd. từ trang việc của dự án khác)
export function ProjectLink({
  code,
  href,
  className,
  children,
}: {
  code: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          await switchProject(code);
          router.push(href);
        });
      }}
      className={className}
    >
      {children}
    </a>
  );
}
