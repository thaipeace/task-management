import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { comments, invites, meta, records, sprints, taskLogs, tasks, users } from "@/db/schema";

export type TaskFilters = {
  q?: string;
  sprint?: string;
  area?: string;
  priority?: string;
  type?: string;
  assignee?: string; // id | "me" | "none"
};

export function readFilters(sp: Record<string, string | string[] | undefined>): TaskFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  return {
    q: one("q"),
    sprint: one("sprint"),
    area: one("area"),
    priority: one("priority"),
    type: one("type"),
    assignee: one("assignee"),
  };
}

export async function listTasks(f: TaskFilters, meId: number) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(tasks.key, like), ilike(tasks.title, like), ilike(tasks.description, like))!);
  }
  if (f.sprint === "none") where.push(isNull(tasks.sprint));
  else if (f.sprint) where.push(eq(tasks.sprint, f.sprint));
  if (f.area) where.push(eq(tasks.area, f.area));
  if (f.priority) where.push(eq(tasks.priority, f.priority));
  if (f.type) where.push(eq(tasks.type, f.type));
  if (f.assignee === "me") where.push(eq(tasks.assigneeId, meId));
  else if (f.assignee === "none") where.push(isNull(tasks.assigneeId));
  else if (f.assignee) where.push(eq(tasks.assigneeId, Number(f.assignee)));

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
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(tasks.position), asc(tasks.key));
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTask(key: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.key, key));
  if (!row) return null;
  const [logs, commentRows] = await Promise.all([
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
        userId: comments.userId,
        userName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.taskKey, key))
      .orderBy(asc(comments.id)),
  ]);
  return { task: row, logs, comments: commentRows };
}

export function listSprints() {
  return db.select().from(sprints).orderBy(asc(sprints.position), asc(sprints.code));
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

export function listRecords(kind: "risk" | "decision") {
  return db
    .select()
    .from(records)
    .where(eq(records.kind, kind))
    .orderBy(asc(records.position), asc(records.key));
}

export async function sprintStats() {
  return db
    .select({
      sprint: tasks.sprint,
      status: tasks.status,
      n: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .groupBy(tasks.sprint, tasks.status);
}

export async function getMeta(key: string) {
  const [row] = await db.select().from(meta).where(eq(meta.key, key));
  return row?.value ?? null;
}
