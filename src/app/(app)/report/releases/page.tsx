import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import Link from "next/link";
import { listDevReleases, releaseVersion, tasksByVersion } from "@/lib/releases";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Dev release" };

const DATE = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export default function ReleasesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Loading />}>
        <ReleasesContent />
      </Suspense>
    </div>
  );
}

async function ReleasesContent() {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const [releases, byVersion] = await Promise.all([listDevReleases(project.id), tasksByVersion(project.id)]);
  const recorded = new Set(releases.map((r) => releaseVersion(r.mainVersion, r.rc)));
  // việc gắn version chưa có đợt ghi (vd. gắn tay, hoặc tên nhánh khác dạng rc)
  const orphans = [...byVersion.keys()].filter((v) => !recorded.has(v)).sort().reverse();

  return (
    <>
      <PageHeader title={`Dev release · ${project.name}`} subtitle="Các đợt release lên Dev, đánh số theo version của main." />
      <ReportTabs />
      {releases.length === 0 && orphans.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có đợt release nào. Agent ghi bằng lệnh tm release-save.</p>
      ) : (
        <div className="space-y-4">
          {releases.map((r) => {
            const version = releaseVersion(r.mainVersion, r.rc);
            return (
              <section key={r.id} id={version} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                  <h2 className="font-mono text-base font-semibold">{version}</h2>
                  <span className="text-xs text-slate-500">{DATE.format(r.createdAt)}</span>
                </div>
                <RichText text={r.body} className="text-sm" />
                <TaskList items={byVersion.get(version)} />
              </section>
            );
          })}
          {orphans.map((v) => (
            <section key={v} id={v} className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-mono text-base font-semibold">{v}</h2>
                <span className="text-xs text-slate-500">chưa có ghi chú đợt release</span>
              </div>
              <TaskList items={byVersion.get(v)} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function TaskList({ items }: { items?: { key: string; title: string; status: string }[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <h3 className="mb-1 text-xs font-semibold text-slate-700">Việc trong bản này ({items.length})</h3>
      <ul className="space-y-0.5 text-xs text-slate-700">
        {items.map((t) => (
          <li key={t.key} className="flex items-center gap-2">
            <Link href={`/tasks/${t.key}`} className="font-semibold text-brand hover:underline">
              {t.key}
            </Link>
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <StatusBadge status={t.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
