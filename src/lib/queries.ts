import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { comments, invites, meta, projects, records, sprints, taskAliases, taskLogs, tasks, users } from "@/db/schema";

// Mỗi bộ lọc là danh sách (rỗng = không lọc). Trong một bộ lọc: HOẶC; giữa các bộ lọc: VÀ.
// Trên URL: giá trị ngăn bằng dấu phẩy, vd. ?area=BE,FE&priority=P0,P1
export type TaskFilters = {
  q?: string;
  sprint: string[]; // mã đợt | "none"
  area: string[];
  priority: string[];
  type: string[];
  assignee: string[]; // id | "me" | "none"
  sub: boolean; // hiện việc con (mặc định có; ?sub=0 để ẩn)
};

export const LIST_FILTER_KEYS = ["sprint", "area", "priority", "type", "assignee"] as const;

export function readFilters(sp: Record<string, string | string[] | undefined>): TaskFilters {
  const list = (k: string) => {
    const v = sp[k];
    return [...new Set((Array.isArray(v) ? v : [v ?? ""]).flatMap((x) => x.split(",")).filter(Boolean))];
  };
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return {
    q: q || undefined,
    sprint: list("sprint"),
    area: list("area"),
    priority: list("priority"),
    type: list("type"),
    assignee: list("assignee"),
    sub: sp.sub !== "0",
  };
}

// cột thuộc danh sách, kèm "none" = cột rỗng
function inListOrNull(col: typeof tasks.sprint, values: string[]) {
  const real = values.filter((v) => v !== "none");
  const parts: SQL[] = [];
  if (real.length) parts.push(inArray(col, real));
  if (values.includes("none")) parts.push(isNull(col));
  return or(...parts)!;
}

// Bảng / backlog: việc lớn và việc con (mỗi việc con một thẻ, ghi rõ việc cha), kèm tiến độ việc con
export async function listTasks(projectId: number, f: TaskFilters, meId: number) {
  const where: SQL[] = [eq(tasks.projectId, projectId)];
  if (!f.sub) where.push(isNull(tasks.parentKey));
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(
      or(
        ilike(tasks.key, like),
        ilike(tasks.title, like),
        ilike(tasks.description, like),
        // tìm theo id cũ (BE-010)
        sql`exists (select 1 from ${taskAliases} a where a.new_key = ${tasks.key} and a.old_key ilike ${like})`,
      )!,
    );
  }
  if (f.sprint.length) where.push(inListOrNull(tasks.sprint, f.sprint));
  if (f.area.length) where.push(inArray(tasks.area, f.area));
  if (f.priority.length) where.push(inArray(tasks.priority, f.priority));
  if (f.type.length) where.push(inArray(tasks.type, f.type));
  if (f.assignee.length) {
    const ids = f.assignee.flatMap((a) => (a === "me" ? [meId] : /^\d+$/.test(a) ? [Number(a)] : []));
    const parts: SQL[] = [];
    if (ids.length) parts.push(inArray(tasks.assigneeId, ids));
    if (f.assignee.includes("none")) parts.push(isNull(tasks.assigneeId));
    if (parts.length) where.push(or(...parts)!);
  }

  return db
    .select({
      key: tasks.key,
      title: tasks.title,
      area: tasks.area,
      type: tasks.type,
      sprint: tasks.sprint,
      priority: tasks.priority,
      status: tasks.status,
      estimate: tasks.estimate,
      position: tasks.position,
      updatedOn: tasks.updatedOn,
      needsApproval: sql<boolean>`${tasks.approval} is not null and ${tasks.approval} <> 'null'::jsonb`,
      dependsOn: tasks.dependsOn,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      parentKey: tasks.parentKey,
      parentTitle: sql<string | null>`(select p.title from tasks p where p.key = ${tasks.parentKey})`,
      subOrder: tasks.subOrder,
      subTotal: sql<number>`(select count(*)::int from tasks c where c.parent_key = ${tasks.key})`,
      subDone: sql<number>`(select count(*)::int from tasks c where c.parent_key = ${tasks.key} and c.status in ('xong', 'released'))`,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(...where))
    .orderBy(asc(tasks.position), asc(tasks.key));
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTask(key: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.key, key));
  if (!row) return null;
  const [logs, commentRows, subtasks, parent, [project]] = await Promise.all([
    db
      .select({ id: taskLogs.id, date: taskLogs.date, text: taskLogs.text, userName: users.name })
      .from(taskLogs)
      .leftJoin(users, eq(users.id, taskLogs.userId))
      .where(eq(taskLogs.taskKey, key))
      .orderBy(desc(taskLogs.id)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        userId: comments.userId,
        userName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.taskKey, key))
      .orderBy(desc(comments.id)), // mới nhất lên trên
    db
      .select({
        key: tasks.key,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        subOrder: tasks.subOrder,
        assigneeName: users.name,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(eq(tasks.parentKey, key))
      .orderBy(asc(tasks.subOrder), asc(tasks.key)),
    row.parentKey
      ? db
          .select({ key: tasks.key, title: tasks.title })
          .from(tasks)
          .where(eq(tasks.key, row.parentKey))
          .then((r) => r[0] ?? null)
      : null,
    db.select().from(projects).where(eq(projects.id, row.projectId)),
  ]);
  return { task: row, logs, comments: commentRows, subtasks, parent, project };
}

export function listSprints(projectId: number) {
  return db
    .select()
    .from(sprints)
    .where(eq(sprints.projectId, projectId))
    .orderBy(asc(sprints.position), asc(sprints.code));
}

export function listActiveUsers() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
}

export function listAllUsers() {
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export function listPendingInvites() {
  return db
    .select()
    .from(invites)
    .where(and(isNull(invites.usedAt), sql`${invites.expiresAt} > now()`))
    .orderBy(desc(invites.createdAt));
}

export function listRecords(projectId: number, kind: "risk" | "decision") {
  return db
    .select()
    .from(records)
    .where(and(eq(records.projectId, projectId), eq(records.kind, kind)))
    .orderBy(asc(records.position), asc(records.key));
}

export async function sprintStats(projectId: number) {
  return db
    .select({
      sprint: tasks.sprint,
      status: tasks.status,
      n: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.sprint, tasks.status);
}

export async function getMeta(projectId: number, key: string) {
  const [row] = await db
    .select()
    .from(meta)
    .where(and(eq(meta.projectId, projectId), eq(meta.key, key)));
  return row?.value ?? null;
}
