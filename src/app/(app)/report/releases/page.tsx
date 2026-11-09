import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { listDevReleases, releaseVersion } from "@/lib/releases";

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
  const releases = await listDevReleases(project.id);

  return (
    <>
      <PageHeader title={`Dev release · ${project.name}`} subtitle="Các đợt release lên Dev, đánh số theo version của main." />
      <ReportTabs />
      {releases.length === 0 ? (
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
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
