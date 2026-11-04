import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateTask } from "@/app/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { Loading, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listActiveUsers, listSprints } from "@/lib/queries";

export default function EditTaskPage({ params }: PageProps<"/tasks/[key]/edit">) {
  return (
    <Suspense fallback={<Loading />}>
      <EditContent params={params} />
    </Suspense>
  );
}

async function EditContent({ params }: Pick<PageProps<"/tasks/[key]/edit">, "params">) {
  await requireUser();
  const key = decodeURIComponent((await params).key);
  const [[task], users] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.key, key)),
    listActiveUsers(),
  ]);
  if (!task) notFound();
  const sprints = await listSprints(task.projectId);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Sửa ${task.key}`} />
      <TaskForm
        action={updateTask.bind(null, task.key)}
        task={task}
        sprints={sprints}
        users={users}
        cancelHref={`/tasks/${task.key}`}
      />
    </div>
  );
}
