import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { comments, projects, taskAliases, taskLogs, tasks, users } from "@/db/schema";
import { ApiError, assigneeEmails } from "./api";
import { toBacklogTask } from "./backlog";
import { normalizeKey } from "./task-keys";

export async function getApiTask(key: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.key, key));
  if (!t) throw new ApiError(404, `Không có việc '${key}'`);
  const [logs, commentRows, emails, subtasks, [project]] = await Promise.all([
    db
      .select({ ngay: taskLogs.date, ghi: taskLogs.text })
      .from(taskLogs)
      .where(eq(taskLogs.taskKey, key))
      .orderBy(asc(taskLogs.id)),
    db
      .select({
        id: comments.id,
        nguoi: users.email,
        noi_dung: comments.body,
        luc: comments.createdAt,
        sua_luc: comments.editedAt,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.taskKey, key))
      .orderBy(asc(comments.id)),
    assigneeEmails([t.assigneeId]),
    db
      .select({ id: tasks.key, tieu_de: tasks.title, trang_thai: tasks.status })
      .from(tasks)
      .where(eq(tasks.parentKey, key))
      .orderBy(asc(tasks.subOrder), asc(tasks.key)),
    db.select({ code: projects.code }).from(projects).where(eq(projects.id, t.projectId)),
  ]);
  return {
    du_an: project?.code ?? null,
    ...toBacklogTask(t, t.assigneeId ? (emails.get(t.assigneeId) ?? null) : null, logs),
    // việc con không có việc con nên không trả danh sách rỗng cho nó
    ...(t.parentKey ? {} : { viec_con: subtasks }),
    binh_luan: commentRows,
  };
}

export type ListQuery = {
  du_an?: number; // id dự án (route đổi từ mã); không có = mọi dự án
  trang_thai?: string[];
  dot?: string;
  mang?: string;
  uu_tien?: string;
  loai?: string;
  nguoi_lam?: string; // email | "none"
  q?: string;
  khoa_ngoai?: string;
  viec_cha?: string; // id | "none" (chỉ việc lớn)
  gioi_han: number;
};

export async function listApiTasks(f: ListQuery, meId: number) {
  const where: SQL[] = [];
  if (f.du_an) where.push(eq(tasks.projectId, f.du_an));
  if (f.trang_thai?.length) where.push(inArray(tasks.status, f.trang_thai));
  if (f.dot === "none") where.push(isNull(tasks.sprint));
  else if (f.dot) where.push(eq(tasks.sprint, f.dot));
  if (f.mang) where.push(eq(tasks.area, f.mang));
  if (f.uu_tien) where.push(eq(tasks.priority, f.uu_tien));
  if (f.loai) where.push(eq(tasks.type, f.loai));
  if (f.khoa_ngoai) where.push(eq(tasks.externalKey, f.khoa_ngoai));
  if (f.viec_cha === "none") where.push(isNull(tasks.parentKey));
  else if (f.viec_cha) where.push(eq(tasks.parentKey, normalizeKey(f.viec_cha)));
  if (f.nguoi_lam === "none") where.push(isNull(tasks.assigneeId));
  else if (f.nguoi_lam === "me") where.push(eq(tasks.assigneeId, meId));
  else if (f.nguoi_lam) where.push(eq(users.email, f.nguoi_lam.toLowerCase()));
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
  const rows = await db
    .select({ task: tasks, email: users.email, project: projects.code })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(tasks.seq))
    .limit(f.gioi_han);
  // danh sách không kèm nhật ký – lấy chi tiết qua GET /api/v1/tasks/{id}
  return rows.map(({ task, email, project }) => {
    const full: Partial<ReturnType<typeof toBacklogTask>> = toBacklogTask(task, email, []);
    delete full.nhat_ky;
    return { du_an: project, ...full };
  });
}
