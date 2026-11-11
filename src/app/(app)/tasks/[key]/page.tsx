import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { addComment, addLog } from "@/app/actions/tasks";
import { ToastForm } from "@/components/toast-form";
import { ProjectLink } from "@/components/project-switcher";
import { MarkdownField } from "@/components/markdown-field";
import { IdLinks, RichText } from "@/components/rich-text";
import { Subtasks } from "@/components/subtasks";
import { AssigneeSelect, CommentBody, DeleteCommentButton, StatusSelect } from "@/components/task-quick";
import { AreaBadge, Avatar, Loading, PriorityBadge, TypeIcon } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AREAS, ESTIMATES, PRIORITIES, TYPES, labelOf } from "@/lib/constants";
import { getTask, listActiveUsers } from "@/lib/queries";
import { resolveTaskKey } from "@/lib/task-service";

export default function TaskPage({ params }: PageProps<"/tasks/[key]">) {
  return (
    <Suspense fallback={<Loading />}>
      <TaskContent params={params} />
    </Suspense>
  );
}

async function TaskContent({ params }: Pick<PageProps<"/tasks/[key]">, "params">) {
  const me = await requireUser();
  const { key } = await params;
  const [data, users] = await Promise.all([getTask(decodeURIComponent(key)), listActiveUsers()]);
  if (!data) {
    // id cũ (BE-010) hoặc gõ sai chữ hoa / thường → về id đúng
    const real = await resolveTaskKey(decodeURIComponent(key));
    if (real) redirect(`/tasks/${real}`);
    notFound();
  }
  const { task: t, logs, comments, subtasks, parent, project } = data;
  const fmt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <ProjectLink code={project.code} href="/backlog" className="hover:underline">
          <span title={project.name} className="font-semibold">{project.code}</span> · Backlog
        </ProjectLink>
        <span>/</span>
        {t.sprint && (
          <>
            <ProjectLink
              code={project.code}
              href={`/backlog?sprint=${encodeURIComponent(t.sprint)}`}
              className="hover:underline"
            >
              {t.sprint}
            </ProjectLink>
            <span>/</span>
          </>
        )}
        {parent && (
          <>
            <Link href={`/tasks/${parent.key}`} className="hover:underline" title={parent.title}>
              {parent.key}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <TypeIcon type={t.type} /> {t.key}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-semibold leading-snug">{t.title}</h1>
            <Link href={`/tasks/${t.key}/edit`} className="btn-secondary shrink-0">
              Sửa
            </Link>
          </div>

          {parent && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Việc con của{" "}
              <Link href={`/tasks/${parent.key}`} className="font-semibold text-brand hover:underline">
                {parent.key}
              </Link>{" "}
              · {parent.title}
            </p>
          )}

          <Section title="Mô tả">
            {t.description ? <RichText text={t.description} /> : <Empty />}
          </Section>

          <ListSection title="Việc cần làm" items={t.steps} ordered />
          <ListSection title="Tiêu chí xong" items={t.doneCriteria} check />
          <ListSection title="Bằng chứng" items={t.evidence} mono />
          <ListSection title="Kiểm thử" items={t.tests} mono />
          <Section title="Rủi ro">{t.risk ? <RichText text={t.risk} /> : <Empty />}</Section>

          <Section title="Liên quan">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">Việc</dt>
              <dd>
                <IdLinks ids={t.related.viec} />
              </dd>
              <dt className="text-slate-500">Tài liệu</dt>
              <dd>
                {t.related.tai_lieu.length ? (
                  <ul className="space-y-1">
                    {t.related.tai_lieu.map((d, i) => (
                      <li key={i} className="font-mono text-xs">
                        {d}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty />
                )}
              </dd>
              <dt className="text-slate-500">Issue</dt>
              <dd>{t.related.issue != null ? <MaybeLink value={t.related.issue} /> : <Empty />}</dd>
              <dt className="text-slate-500">PR</dt>
              <dd>{t.related.pr != null ? <MaybeLink value={t.related.pr} /> : <Empty />}</dd>
            </dl>
          </Section>

          {/* việc con chỉ một cấp: việc con không có danh sách việc con */}
          {!t.parentKey && <Subtasks parentKey={t.key} items={subtasks} />}

          <CollapsibleSection title={`Bình luận (${comments.length})`} defaultOpen>
            <ToastForm action={addComment.bind(null, t.key)} loading="Đang gửi bình luận…" success="Đã gửi bình luận" error="Không gửi được bình luận" className="mb-4 flex gap-3">
              <Avatar name={me.name} size={28} />
              <div className="flex-1">
                <MarkdownField name="body" rows={3} required placeholder="Thêm bình luận… (Markdown: **đậm**, `code`, [link](url))" />
                <button className="btn-primary mt-2">Gửi</button>
              </div>
            </ToastForm>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar name={c.userName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{c.userName ?? "?"}</span>
                      {fmt.format(c.createdAt)}
                      {c.editedAt && <span title={`Sửa lúc ${fmt.format(c.editedAt)}`}>(đã sửa)</span>}
                      {(c.userId === me.id || me.role === "admin") && <DeleteCommentButton id={c.id} />}
                    </div>
                    <CommentBody id={c.id} body={c.body} canEdit={c.userId === me.id}>
                      <RichText text={c.body} className="mt-0.5 block text-sm" />
                    </CommentBody>
                  </div>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title={`Nhật ký (${logs.length})`}>
            <ToastForm action={addLog.bind(null, t.key)} loading="Đang ghi nhật ký…" success="Đã ghi nhật ký" error="Không ghi được nhật ký" className="mb-3 flex gap-2">
              <input name="text" required placeholder="Ghi một dòng nhật ký…" className="input" />
              <button className="btn-secondary shrink-0">Ghi</button>
            </ToastForm>
            <ol className="space-y-1.5 border-l-2 border-slate-200 pl-4 text-sm">
              {logs.map((l) => (
                <li key={l.id}>
                  <span className="mr-2 font-mono text-xs text-slate-500">{l.date}</span>
                  <RichText text={l.text} inline />
                </li>
              ))}
            </ol>
          </CollapsibleSection>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-4 p-4">
            <div>
              <div className="label">Trạng thái</div>
              <StatusSelect key={t.status} taskKey={t.key} status={t.status} />
            </div>
            <div>
              <div className="label">Người làm</div>
              <AssigneeSelect key={t.assigneeId ?? 0} taskKey={t.key} assigneeId={t.assigneeId} users={users} />
            </div>
          </div>
          <div className="card p-4">
            <dl className="grid grid-cols-[96px_1fr] items-center gap-x-3 gap-y-3 text-sm">
              <dt className="text-slate-500">Ưu tiên</dt>
              <dd className="flex items-center gap-2">
                <PriorityBadge priority={t.priority} />
                <span className="text-xs text-slate-600">{labelOf(PRIORITIES, t.priority).split("·")[1]}</span>
              </dd>
              <dt className="text-slate-500">Mảng</dt>
              <dd className="flex items-center gap-2">
                <AreaBadge area={t.area} />
                <span className="text-xs text-slate-600">{labelOf(AREAS, t.area).split("·")[1]}</span>
              </dd>
              <dt className="text-slate-500">Loại</dt>
              <dd>
                <TypeIcon type={t.type} /> {labelOf(TYPES, t.type)}
              </dd>
              <dt className="text-slate-500">Đợt</dt>
              <dd className="break-all">{t.sprint ?? <Empty />}</dd>
              <dt className="text-slate-500">Ước lượng</dt>
              <dd>{t.estimate ? labelOf(ESTIMATES, t.estimate) : <Empty />}</dd>
              <dt className="text-slate-500">Bản release</dt>
              <dd className="font-mono text-xs">
                {t.releasedVersion ? (
                  <Link href={`/report/releases/${project.code}/${t.releasedVersion}`} className="text-brand hover:underline">
                    {t.releasedVersion}
                  </Link>
                ) : (
                  <Empty />
                )}
              </dd>
              <dt className="text-slate-500">Phụ thuộc</dt>
              <dd>
                <IdLinks ids={t.dependsOn} />
              </dd>
              <dt className="text-slate-500">Nhánh</dt>
              <dd className="font-mono text-xs break-all">{t.branch ?? <Empty />}</dd>
              <dt className="text-slate-500">Nguồn</dt>
              <dd className="text-xs">{t.source || <Empty />}</dd>
              <dt className="text-slate-500">Tạo / sửa</dt>
              <dd className="font-mono text-xs">
                {t.createdOn} · {t.updatedOn}
              </dd>
            </dl>
          </div>
          {t.approval && (
            <div className="card border-rose-200 bg-rose-50 p-4 text-sm">
              <div className="label text-rose-700">Cần phê duyệt</div>
              <div className="font-semibold">{t.approval.ai}</div>
              <div className="mt-1 text-rose-900">{t.approval.ly_do}</div>
            </div>
          )}
          {Object.keys(t.extra).length > 0 && (
            <div className="card p-4">
              <div className="label">Trường khác (từ tệp import)</div>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(t.extra, null, 2)}</pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="text-sm leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

// <details> gốc của trình duyệt: thu gọn / mở không cần JavaScript
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="mb-2 flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-700 select-none hover:text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="inline-block w-3 text-xs text-slate-400 transition-transform group-open:rotate-90">▶</span>
        {title}
      </summary>
      <div className="text-sm leading-relaxed text-slate-800">{children}</div>
    </details>
  );
}

function ListSection({
  title,
  items,
  ordered,
  check,
  mono,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  check?: boolean;
  mono?: boolean;
}) {
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-5 shrink-0 text-right text-slate-400">
                {check ? "☐" : ordered ? `${i + 1}.` : "•"}
              </span>
              <RichText text={it} inline className={mono ? "font-mono text-xs leading-5" : ""} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function MaybeLink({ value }: { value: string | number }) {
  if (typeof value === "number") return <span>#{value}</span>;
  return /^https?:\/\//.test(value) ? (
    <a href={value} target="_blank" rel="noreferrer" className="text-brand hover:underline">
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
}

function Empty() {
  return <span className="text-slate-400">—</span>;
}
