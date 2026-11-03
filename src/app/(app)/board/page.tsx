import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Board } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listActiveUsers, listSprints, listTasks, readFilters } from "@/lib/queries";

export const metadata: Metadata = { title: "Bảng" };

export default function BoardPage({ searchParams }: PageProps<"/board">) {
  return (
    <>
      <PageHeader
        title="Bảng"
        subtitle="Kéo thẻ giữa các cột để đổi trạng thái – mỗi lần đổi được ghi vào nhật ký."
        actions={
          <Link href="/tasks/new" className="btn-primary">
            + Tạo việc
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <BoardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BoardContent({ searchParams }: Pick<PageProps<"/board">, "searchParams">) {
  const me = await requireUser();
  const filters = readFilters(await searchParams);
  const [tasks, sprints, users] = await Promise.all([
    listTasks(filters, me.id),
    listSprints(),
    listActiveUsers(),
  ]);
  return (
    <>
      <FilterBar filters={filters} sprints={sprints} users={users} />
      <Board tasks={tasks} />
    </>
  );
}
