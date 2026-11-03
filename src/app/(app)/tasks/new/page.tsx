import type { Metadata } from "next";
import { Suspense } from "react";
import { createTask } from "@/app/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listActiveUsers, listSprints } from "@/lib/queries";

export const metadata: Metadata = { title: "Tạo việc" };

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Tạo việc" subtitle="Id được cấp tự động theo mảng (BE-014, FE-010 …)." />
      <Suspense fallback={<Loading />}>
        <NewContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewContent({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  await requireUser();
  const sp = await searchParams;
  const [sprints, users] = await Promise.all([listSprints(), listActiveUsers()]);
  return (
    <TaskForm
      action={createTask}
      sprints={sprints}
      users={users}
      defaultSprint={typeof sp.sprint === "string" ? sp.sprint : undefined}
      cancelHref="/backlog"
    />
  );
}
