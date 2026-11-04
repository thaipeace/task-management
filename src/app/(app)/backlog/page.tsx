import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { AreaBadge, Avatar, Loading, PageHeader, PriorityBadge, StatusBadge, SubtaskProgress, TypeIcon } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { listActiveUsers, listSprints, listTasks, readFilters, type TaskRow } from "@/lib/queries";

export const metadata: Metadata = { title: "Backlog" };

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export default function BacklogPage({ searchParams }: PageProps<"/backlog">) {
  return (
    <>
      <PageHeader
        title="Backlog"
        subtitle="Mọi việc, nhóm theo đợt, xếp theo ưu tiên."
        actions={
          <Link href="/tasks/new" className="btn-primary">
            + Tạo việc
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <BacklogContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BacklogContent({ searchParams }: Pick<PageProps<"/backlog">, "searchParams">) {
  const [me, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const filters = readFilters(await searchParams);
  const [tasks, sprints, users] = await Promise.all([
    listTasks(project.id, filters, me.id),
    listSprints(project.id),
    listActiveUsers(),
  ]);

  const groups = [
    ...sprints.map((s) => ({ code: s.code as string | null, description: s.description })),
    { code: null, description: "Chưa xếp vào đợt nào" },
  ]
    .map((g) => ({
      ...g,
      items: tasks
        .filter((t) => t.sprint === g.code)
        .sort(
          (a, b) =>
            (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
            a.key.localeCompare(b.key),
        ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <FilterBar filters={filters} sprints={sprints} users={users} />
      {groups.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Không có việc nào.{" "}
          {me.role === "admin" && (
            <Link href="/admin/import" className="text-brand underline">
              Import backlog.json
            </Link>
          )}
        </div>
      )}
      <div className="space-y-6">
        {groups.map((g) => (
          <SprintGroup key={g.code ?? "none"} {...g} />
        ))}
      </div>
    </>
  );
}

function SprintGroup({
  code,
  description,
  items,
}: {
  code: string | null;
  description: string;
  items: TaskRow[];
}) {
  const done = items.filter((t) => t.status === "xong").length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h2 className="font-semibold">{code ?? "Chưa xếp đợt"}</h2>
        <span className="text-sm text-slate-500">{description}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          {done}/{items.length} xong
          <span className="h-1.5 w-24 overflow-hidden rounded bg-slate-200">
            <span className="block h-full bg-green-500" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((t) => (
          <li key={t.key}>
            <Link
              href={`/tasks/${t.key}`}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
            >
              <TypeIcon type={t.type} />
              <span className="min-w-16 shrink-0 text-xs font-semibold whitespace-nowrap text-slate-500">{t.key}</span>
              <span className={`min-w-0 flex-1 truncate ${t.status === "huy" ? "line-through text-slate-400" : ""}`}>
                {t.title}
              </span>
              <SubtaskProgress done={t.subDone} total={t.subTotal} />
              <AreaBadge area={t.area} />
              {t.estimate && (
                <span className="hidden rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-600 sm:inline">
                  {t.estimate}
                </span>
              )}
              <span className="hidden w-24 text-right sm:block">
                <StatusBadge status={t.status} />
              </span>
              <PriorityBadge priority={t.priority} />
              <Avatar name={t.assigneeName} size={22} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
