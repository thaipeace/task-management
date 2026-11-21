import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { addReleaseComment, deleteReleaseComment, updateReleaseComment } from "@/app/actions/releases";
import { AiButton } from "@/components/ai-button";
import { ApproveRelease } from "@/components/approve-release";
import { MarkdownField } from "@/components/markdown-field";
import { ReleaseTextEditor } from "@/components/release-text";
import { CommentBody, DeleteCommentButton } from "@/components/task-quick";
import { ToastForm } from "@/components/toast-form";
import { CopyLink } from "@/components/copy-summary";
import { ReportTabs } from "@/components/report-tabs";
import { RichText } from "@/components/rich-text";
import { AreaBadge, Avatar, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { aiReady } from "@/lib/gemini";
import { projectFromParams } from "@/lib/projects";
import { getDevRelease, listReleaseComments } from "@/lib/releases";

const DATE = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export async function generateMetadata({ params }: PageProps<"/[project]/report/releases/[version]">): Promise<Metadata> {
  const p = await params;
  return { title: `Release ${decodeURIComponent(p.version)} · ${decodeURIComponent(p.project).toUpperCase()}` };
}

export default function ReleasePage({ params }: PageProps<"/[project]/report/releases/[version]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Loading />}>
        <ReleaseContent params={params} />
      </Suspense>
    </div>
  );
}

// Dự án lấy từ đường dẫn, không theo dự án đang chọn – link gửi đi mở đúng bản ở mọi máy
async function ReleaseContent({ params }: Pick<PageProps<"/[project]/report/releases/[version]">, "params">) {
  const me = await requireUser();
  const p = await params;
  const version = decodeURIComponent(p.version);
  const project = await projectFromParams(params);
  const [data, ai, comments] = await Promise.all([getDevRelease(project.id, version), aiReady(), listReleaseComments(project.id, version)]);
  if (!data) notFound();
  const { release, tasks } = data;
  const admin = me.role === "admin";
  const pending = tasks.filter((t) => t.status === "xong").length;

  return (
    <>
      <PageHeader
        title={`Release ${version} · ${project.name}`}
        subtitle={
          release
            ? `Ghi lúc ${DATE.format(release.createdAt)}${release.updatedAt.getTime() - release.createdAt.getTime() > 60_000 ? ` · sửa lúc ${DATE.format(release.updatedAt)}` : ""}`
            : "Có việc gắn bản này nhưng chưa có ghi chú đợt release"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {admin && pending > 0 && <ApproveRelease project={project.code} version={version} pending={pending} />}
            {ai && admin && tasks.length > 0 && (
              <AiButton kind="release" project={project.code} version={version} overwrite={!!release?.body} />
            )}
            <CopyLink />
          </div>
        }
      />
      <ReportTabs />
      <div className="mb-3 text-sm">
        <Link href={`/${project.code}/report/releases`} className="text-brand hover:underline">
          ‹ Tất cả release của {project.code}
        </Link>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Nhận xét chung</h2>
          <Editable admin={admin} project={project.code} version={version} field="body" text={release?.body ?? ""} />
        </section>

        <details className="card group p-5">
          <summary className="cursor-pointer text-base font-semibold select-none">
            Các việc được release <span className="font-normal text-slate-500">({tasks.length})</span>
          </summary>
          {tasks.length ? (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {tasks.map((t) => (
                <li key={t.key} className="flex items-center gap-2 py-1.5">
                  <Link href={`/tasks/${t.key}`} className="w-20 shrink-0 font-semibold text-brand hover:underline">
                    {t.key}
                  </Link>
                  <AreaBadge area={t.area} />
                  <span className="min-w-0 flex-1 truncate">{t.title.replace(/^\[[A-Z]+\]\s*/, "")}</span>
                  {t.assignee && <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{t.assignee}</span>}
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Chưa có việc nào gắn bản này.</p>
          )}
        </details>

        <details className="card p-5">
          <summary className="cursor-pointer text-base font-semibold select-none">Ghi chú thêm</summary>
          <div className="mt-3">
            <Editable admin={admin} project={project.code} version={version} field="notes" text={release?.notes ?? ""} />
          </div>
        </details>

        <section className="card p-5">
          <h2 className="mb-1 text-base font-semibold">
            Bình luận <span className="font-normal text-slate-500">({comments.length})</span>
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Phản hồi sau khi duyệt, điều chỉnh, quyết định, hướng đi quan trọng; tài liệu dán link (Markdown: [tên](https://…)).
          </p>
          <ToastForm
            action={addReleaseComment.bind(null, project.code, version)}
            loading="Đang gửi bình luận…"
            success="Đã gửi bình luận"
            error="Không gửi được bình luận"
            className="mb-4 flex gap-3"
          >
            <Avatar name={me.name} size={28} />
            <div className="flex-1">
              <MarkdownField name="body" rows={3} required placeholder="Thêm bình luận…" />
              <button className="btn-primary mt-2">Gửi</button>
            </div>
          </ToastForm>
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className={`flex gap-3 ${c.kind === "duyet" ? "rounded-lg bg-emerald-50 p-3" : ""}`}>
                <Avatar name={c.userName} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{c.userName ?? "?"}</span>
                    {c.kind === "duyet" && <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-medium text-white">Nhận xét duyệt</span>}
                    {DATE.format(c.createdAt)}
                    {c.editedAt && <span title={`Sửa lúc ${DATE.format(c.editedAt)}`}>(đã sửa)</span>}
                    {(c.userId === me.id || admin) && <DeleteCommentButton id={c.id} remove={deleteReleaseComment} />}
                  </div>
                  <CommentBody id={c.id} body={c.body} canEdit={c.userId === me.id || admin} save={updateReleaseComment}>
                    <RichText text={c.body} className="mt-0.5 block text-sm" />
                  </CommentBody>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Editable(p: { admin: boolean; project: string; version: string; field: "body" | "notes"; text: string }) {
  const view = p.text ? <RichText text={p.text} className="text-sm" /> : <p className="text-sm text-slate-500">Chưa có.</p>;
  if (!p.admin) return view;
  return (
    <ReleaseTextEditor project={p.project} version={p.version} field={p.field} initial={p.text}>
      {view}
    </ReleaseTextEditor>
  );
}
