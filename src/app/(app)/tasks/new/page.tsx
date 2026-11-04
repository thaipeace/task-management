import type { Metadata } from "next";
import { Suspense } from "react";
import { createTask } from "@/app/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { listActiveUsers, listSprints } from "@/lib/queries";

export const metadata: Metadata = { title: "Tạo việc" };

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<Loading />}>
        <NewContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewContent({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const sp = await searchParams;
  const [sprints, users] = await Promise.all([listSprints(project.id), listActiveUsers()]);
  return (
    <>
      <PageHeader
        title={`Tạo việc trong ${project.name}`}
        subtitle={`Id được cấp tự động (${project.code}-039 …); tiêu đề tự thêm [mảng] ở đầu, vd. "[BE] …".`}
      />
      <TaskForm
        action={createTask.bind(null, project.id)}
        sprints={sprints}
        users={users}
        defaultSprint={typeof sp.sprint === "string" ? sp.sprint : undefined}
        cancelHref="/backlog"
      />
    </>
  );
}
