import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Board } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { projectFromParams } from "@/lib/projects";
import { listActiveUsers, listSprints, listTasks, readFilters } from "@/lib/queries";

export const metadata: Metadata = { title: "Bảng" };

export default function BoardPage({ params, searchParams }: PageProps<"/[project]/board">) {
  return (
    <>
      <PageHeader
        title="Bảng"
        subtitle="Kéo thẻ giữa các cột để đổi trạng thái – mỗi lần đổi được ghi vào nhật ký."
        // đường dẫn tương đối: /SIA/board → /SIA/tasks/new
        actions={
          <Link href="tasks/new" className="btn-primary">
            + Tạo việc
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <BoardContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BoardContent({ params, searchParams }: Pick<PageProps<"/[project]/board">, "params" | "searchParams">) {
  const [me, project] = await Promise.all([requireUser(), projectFromParams(params)]);
  const filters = readFilters(await searchParams, false);
  const [tasks, sprints, users] = await Promise.all([
    listTasks(project.id, filters, me.id),
    listSprints(project.id),
    listActiveUsers(),
  ]);
  return (
    <>
      <FilterBar filters={filters} sprints={sprints} users={users} subDefault={false} />
      {/* việc đã Released (duyệt ở tab Dev release) chỉ hiện trên Bảng khi lọc trạng thái có Released */}
      <Board tasks={filters.status.includes("released") ? tasks : tasks.filter((t) => t.status !== "released")} users={users} />
    </>
  );
}
