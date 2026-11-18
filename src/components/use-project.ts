"use client";

import { usePathname } from "next/navigation";

export type ProjectOpt = { code: string; name: string };

// Dự án của tab hiện tại: đoạn đầu đường dẫn (/SIA/board), không có thì theo id việc (/tasks/SIA-010),
// cuối cùng là dự án dùng gần nhất. Mỗi tab theo đường dẫn của nó nên nhiều dự án mở song song được.
export function useProjectCode(projects: ProjectOpt[], fallback: string) {
  const pathname = usePathname();
  const seg = decodeURIComponent(pathname.split("/")[1] ?? "").toUpperCase();
  if (projects.some((p) => p.code === seg)) return seg;
  const task = /^\/tasks\/([^/]+)/.exec(pathname);
  if (task) {
    const key = decodeURIComponent(task[1]).toUpperCase();
    // id việc mở đầu bằng mã dự án: SIA-010, SIS-003a
    const p = projects.filter((x) => key.startsWith(`${x.code}-`)).sort((a, b) => b.code.length - a.code.length)[0];
    if (p) return p.code;
  }
  return fallback;
}
