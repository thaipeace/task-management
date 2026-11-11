import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReportTabs } from "@/components/report-tabs";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { listDevReleases, releaseVersion, taskCountByVersion } from "@/lib/releases";

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
  const [releases, counts] = await Promise.all([listDevReleases(project.id), taskCountByVersion(project.id)]);
  const recorded = new Set(releases.map((r) => releaseVersion(r.mainVersion, r.rc)));
  // việc gắn version chưa có đợt ghi (vd. gắn tay)
  const orphans = [...counts.keys()].filter((v) => !recorded.has(v)).sort().reverse();
  const rows = [
    ...releases.map((r) => {
      const version = releaseVersion(r.mainVersion, r.rc);
      return { version, date: DATE.format(r.createdAt), teaser: teaser(r.body), count: counts.get(version) ?? 0 };
    }),
    ...orphans.map((v) => ({ version: v, date: "", teaser: "Chưa có nhận xét", count: counts.get(v) ?? 0 })),
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
            <li key={r.version}>
              <Link href={`/report/releases/${r.version}`} className="flex items-baseline gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="w-28 shrink-0 font-mono text-sm font-semibold text-brand">{r.version}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.teaser}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {r.count} việc{r.date && ` · ${r.date}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
