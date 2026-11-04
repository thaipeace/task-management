import type { Metadata } from "next";
import { Suspense } from "react";
import { NewProjectForm, ProjectRow } from "@/components/admin-projects";
import { Loading, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getCurrentProject, listProjects, projectStats } from "@/lib/projects";

export const metadata: Metadata = { title: "Dự án" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Dự án"
        subtitle="Mỗi dự án là một backlog riêng: đợt, việc, AR/QD, import / export riêng. Người dùng dùng chung."
      />
      <Suspense fallback={<Loading />}>
        <ProjectsContent />
      </Suspense>
    </div>
  );
}

async function ProjectsContent() {
  await requireAdmin();
  const [projects, stats, current] = await Promise.all([listProjects(), projectStats(), getCurrentProject()]);
  return (
    <div className="space-y-6">
      <NewProjectForm />
      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold">
          Dự án ({projects.length})
        </h2>
        <ul className="divide-y divide-slate-100">
          {projects.map((p) => {
            const s = stats.get(p.id);
            return (
              <ProjectRow
                key={p.id}
                project={{ id: p.id, code: p.code, name: p.name, description: p.description, keyPrefix: p.keyPrefix }}
                stats={{ tasks: s?.tasks ?? 0, open: s?.open ?? 0, sprints: s?.sprints ?? 0 }}
                isCurrent={p.id === current.id}
                canDelete={projects.length > 1 && !s?.tasks}
              />
            );
          })}
        </ul>
      </section>
    </div>
  );
}
