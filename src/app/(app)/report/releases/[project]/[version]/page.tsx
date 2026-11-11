import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyLink } from "@/components/copy-summary";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { AreaBadge, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getProjectByCode } from "@/lib/projects";
import { getDevRelease, releasePath } from "@/lib/releases";

const DATE = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export async function generateMetadata({ params }: PageProps<"/report/releases/[project]/[version]">): Promise<Metadata> {
  const p = await params;
  return { title: `Release ${decodeURIComponent(p.version)} · ${decodeURIComponent(p.project).toUpperCase()}` };
}

export default function ReleasePage({ params }: PageProps<"/report/releases/[project]/[version]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Loading />}>
        <ReleaseContent params={params} />
      </Suspense>
    </div>
  );
}

// Dự án lấy từ đường dẫn, không theo dự án đang chọn – link gửi đi mở đúng bản ở mọi máy
async function ReleaseContent({ params }: Pick<PageProps<"/report/releases/[project]/[version]">, "params">) {
  await requireUser();
  const p = await params;
  const code = decodeURIComponent(p.project);
  const version = decodeURIComponent(p.version);
  const project = await getProjectByCode(code);
  if (!project) notFound();
  if (project.code !== code) redirect(releasePath(project.code, version));
  const data = await getDevRelease(project.id, version);
  if (!data) notFound();
  const { release, tasks } = data;

  return (
    <>
      <PageHeader
        title={`Release ${version} · ${project.name}`}
        subtitle={
          release
            ? `Ghi lúc ${DATE.format(release.createdAt)}${release.updatedAt.getTime() - release.createdAt.getTime() > 60_000 ? ` · sửa lúc ${DATE.format(release.updatedAt)}` : ""}`
            : "Có việc gắn bản này nhưng chưa có ghi chú đợt release"
        }
        actions={<CopyLink />}
      />
      <ReportTabs />
      <div className="mb-3 text-sm">
        <Link href={`/report/releases/${project.code}`} className="text-brand hover:underline">
          ‹ Tất cả release của {project.code}
        </Link>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Nhận xét chung</h2>
          {release?.body ? <RichText text={release.body} className="text-sm" /> : <p className="text-sm text-slate-500">Chưa có.</p>}
        </section>

        <details className="card group p-5">
          <summary className="cursor-pointer text-base font-semibold select-none">
            Các việc được release <span className="font-normal text-slate-500">({tasks.length})</span>
          </summary>
          {tasks.length ? (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {tasks.map((t) => (
                <li key={t.key} className="flex items-center gap-2 py-1.5">
                  <Link href={`/tasks/${t.key}`} className="w-20 shrink-0 font-semibold text-brand hover:underline">
                    {t.key}
                  </Link>
                  <AreaBadge area={t.area} />
                  <span className="min-w-0 flex-1 truncate">{t.title.replace(/^\[[A-Z]+\]\s*/, "")}</span>
                  {t.assignee && <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{t.assignee}</span>}
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Chưa có việc nào gắn bản này.</p>
          )}
        </details>

        <details className="card p-5">
          <summary className="cursor-pointer text-base font-semibold select-none">Ghi chú thêm</summary>
          <div className="mt-3">
            {release?.notes ? <RichText text={release.notes} className="text-sm" /> : <p className="text-sm text-slate-500">Chưa có.</p>}
          </div>
        </details>
      </div>
    </>
  );
}
