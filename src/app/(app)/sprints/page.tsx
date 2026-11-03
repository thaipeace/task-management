import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SprintForm } from "@/components/inline-forms";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { STATUSES } from "@/lib/constants";
import { listSprints, sprintStats } from "@/lib/queries";

export const metadata: Metadata = { title: "Đợt" };

export default function SprintsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Đợt" subtitle='Tương ứng mục "dot" trong backlog.json.' />
      <Suspense fallback={<Loading />}>
        <SprintsContent />
      </Suspense>
    </div>
  );
}

async function SprintsContent() {
  const me = await requireUser();
  const [sprints, stats] = await Promise.all([listSprints(), sprintStats()]);
  const count = (code: string | null, status?: string) =>
    stats
      .filter((s) => s.sprint === code && (!status || s.status === status))
      .reduce((n, s) => n + s.n, 0);

  return (
    <div className="space-y-4">
      {sprints.map((s) => {
        const total = count(s.code);
        return (
          <div key={s.code} className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/board?sprint=${encodeURIComponent(s.code)}`} className="font-semibold text-brand hover:underline">
                {s.code}
              </Link>
              <span className="text-slate-500">· {total} việc</span>
              <div className="ml-auto flex h-2 w-56 overflow-hidden rounded bg-slate-100">
                {STATUSES.map((st) => {
                  const n = count(s.code, st.value);
                  return n ? (
                    <span
                      key={st.value}
                      title={`${st.label}: ${n}`}
                      className={st.color.split(" ")[0]}
                      style={{ width: `${(n / total) * 100}%`, filter: "saturate(2.5) brightness(0.9)" }}
                    />
                  ) : null;
                })}
              </div>
              <span className="w-full text-xs text-slate-500 sm:w-auto">
                {STATUSES.map((st) => `${st.label} ${count(s.code, st.value)}`).join(" · ")}
              </span>
            </div>
            <SprintForm sprint={s} canDelete={me.role === "admin"} />
          </div>
        );
      })}
      <div className="card border-dashed p-4">
        <SprintForm />
      </div>
    </div>
  );
}
