import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { Loading } from "./ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

// Đường dẫn cũ không có mã dự án (/board, /report/weekly?tuan=…) → cùng trang của dự án dùng gần nhất
export function ToProject({ path, searchParams }: { path: string; searchParams?: SP }) {
  return (
    <Suspense fallback={<Loading />}>
      <Go path={path} searchParams={searchParams} />
    </Suspense>
  );
}

async function Go({ path, searchParams }: { path: string; searchParams?: SP }): Promise<never> {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) for (const x of [v ?? []].flat()) sp.append(k, x);
  const qs = sp.toString();
  redirect(`/${project.code}${path}${qs ? `?${qs}` : ""}`);
}
