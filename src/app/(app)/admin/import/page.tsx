import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportForm } from "@/components/import-form";
import { Loading, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getCurrentProject, getProjectByCode } from "@/lib/projects";

export const metadata: Metadata = { title: "Import / Export" };

export default function ImportPage({ searchParams }: PageProps<"/admin/import">) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Import / Export" subtitle="Đồng bộ backlog.json của dự án đang chọn (đổi dự án ở góc trên bên trái)." />
      <Suspense fallback={<Loading />}>
        <ImportContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ImportContent({ searchParams }: Pick<PageProps<"/admin/import">, "searchParams">) {
  await requireAdmin();
  // ?du_an=SIA (từ Backlog / menu); không có thì dự án dùng gần nhất
  const du = (await searchParams).du_an;
  const project = (typeof du === "string" && (await getProjectByCode(du))) || (await getCurrentProject());
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">Import vào {project.code} · {project.name}</h2>
        <ImportForm key={project.id} project={{ id: project.id, code: project.code, keyPrefix: project.keyPrefix }} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Export {project.code}</h2>
        <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
          <p className="flex-1 text-slate-600">
            Tải về backlog.json đúng cấu trúc cũ (giữ _huong_dan, goc_ma, dem_id, nhật ký…). Thêm trường{" "}
            <code className="rounded bg-slate-100 px-1">nguoi_lam</code> (email) cho việc đã giao. Bình luận
            không nằm trong tệp.
          </p>
          <a href={`/api/export?du_an=${project.code}`} className="btn-primary">
            Tải backlog.json
          </a>
        </div>
      </section>
    </div>
  );
}
