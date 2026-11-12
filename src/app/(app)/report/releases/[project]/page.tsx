import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ApproveRelease } from "@/components/approve-release";
import { ReportTabs } from "@/components/report-tabs";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject, getProjectByCode } from "@/lib/projects";
import { listDevReleases, releasePath, releaseVersion, taskCountByVersion } from "@/lib/releases";

export const metadata: Metadata = { title: "Dev release" };

const DATE = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

// Dòng đầu có chữ của phần nhận xét chung, bỏ ký hiệu Markdown
function teaser(body: string) {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/[*_`]/g, "").trim())
    .find(Boolean);
  return line && line.length > 160 ? line.slice(0, 157) + "…" : line;
}

export default function ReleasesPage({ params }: PageProps<"/report/releases/[project]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Loading />}>
        <ReleasesContent params={params} />
      </Suspense>
    </div>
  );
}

async function ReleasesContent({ params }: Pick<PageProps<"/report/releases/[project]">, "params">) {
  const me = await requireUser();
  const code = decodeURIComponent((await params).project);
  const project = await getProjectByCode(code);
  if (!project) {
    // link cũ không có mã dự án: /report/releases/2.45.8-rc1 → dự án đang chọn
    if (/^\d+\.\d+\.\d+/.test(code)) redirect(releasePath((await getCurrentProject()).code, code));
    notFound();
  }
  if (project.code !== code) redirect(`/report/releases/${project.code}`);
  const [releases, counts] = await Promise.all([listDevReleases(project.id), taskCountByVersion(project.id)]);
  const recorded = new Set(releases.map((r) => releaseVersion(r.mainVersion, r.rc)));
  // việc gắn version chưa có đợt ghi (vd. gắn tay)
  const orphans = [...counts.keys()].filter((v) => !recorded.has(v)).sort().reverse();
  const rows = [
    ...releases.map((r) => {
      const version = releaseVersion(r.mainVersion, r.rc);
      const c = counts.get(version) ?? { total: 0, pending: 0 };
      return { version, date: DATE.format(r.createdAt), teaser: teaser(r.body), ...c, approved: r.approvedAt };
    }),
    ...orphans.map((v) => ({ version: v, date: "", teaser: "Chưa có nhận xét", ...counts.get(v)!, approved: null })),
  ];

  return (
    <>
      <PageHeader title={`Dev release · ${project.name}`} subtitle="Mỗi đợt release lên Dev một trang riêng, đánh số theo version của main." />
      <ReportTabs />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có đợt release nào. Agent ghi bằng lệnh tm release-save.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.version} className="flex items-center gap-3 pr-4 hover:bg-slate-50">
              <Link href={releasePath(project.code, r.version)} className="flex min-w-0 flex-1 items-baseline gap-3 py-3 pl-4">
                <span className="w-28 shrink-0 font-mono text-sm font-semibold text-brand">{r.version}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.teaser}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {r.total} việc{r.date && ` · ${r.date}`}
                </span>
              </Link>
              {r.pending > 0 && me.role === "admin" ? (
                <ApproveRelease project={project.code} version={r.version} pending={r.pending} />
              ) : r.approved ? (
                <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white" title={DATE.format(r.approved)}>
                  Đã duyệt
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
