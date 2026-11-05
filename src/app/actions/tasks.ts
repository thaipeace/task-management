"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { comments, projects, records, sprints, taskLogs, tasks } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { nextKey } from "@/lib/backlog";
import { AREAS, ESTIMATES, PRIORITIES, RECORD_KINDS, STATUSES, TYPES, today } from "@/lib/constants";
import { normalizeKey } from "@/lib/task-keys";
import {
  TaskRuleError,
  createTaskCore,
  reorderSubtask,
  statusLog,
  updateTaskCore,
} from "@/lib/task-service";

// conflictAt: việc đã bị người khác sửa trong lúc mình đang soạn – bấm Lưu lần nữa thì ghi đè
export type TaskFormState = { error?: string; ok?: string; conflictAt?: string } | undefined;

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const lines = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
const ids = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map(normalizeKey),
  );
const issueRef = z
  .string()
  .default("")
  .transform((s) => {
    const v = s.trim().replace(/^#/, "");
    return v === "" ? null : /^\d+$/.test(v) ? Number(v) : v;
  });
const nullable = z
  .string()
  .default("")
  .transform((s) => s.trim() || null);

const taskForm = z.object({
  title: z.string().trim().min(1, "Cần nhập tiêu đề"),
  area: z.enum(values(AREAS)),
  type: z.enum(values(TYPES)),
  sprint: nullable,
  priority: z.enum(values(PRIORITIES)),
  status: z.enum(values(STATUSES)),
  estimate: z.union([z.literal(""), z.enum(values(ESTIMATES))]).transform((v) => v || null),
  assigneeId: z
    .string()
    .default("")
    .transform((v) => (v ? Number(v) : null)),
  description: z.string().default(""),
  evidence: lines,
  steps: lines,
  doneCriteria: lines,
  tests: lines,
  risk: z.string().default(""),
  approvalWho: z.string().trim().default(""),
  approvalWhy: z.string().trim().default(""),
  dependsOn: ids,
  relIssue: issueRef,
  relPr: issueRef,
  relTasks: ids,
  relDocs: lines,
  branch: nullable,
  source: z.string().default(""),
});

function parseTaskForm(form: FormData) {
  const parsed = taskForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  return {
    data: {
      title: d.title,
      area: d.area,
      type: d.type,
      sprint: d.sprint,
      priority: d.priority,
      status: d.status,
      estimate: d.estimate,
      assigneeId: d.assigneeId,
      description: d.description,
      evidence: d.evidence,
      steps: d.steps,
      doneCriteria: d.doneCriteria,
      tests: d.tests,
      risk: d.risk,
      approval: d.approvalWho || d.approvalWhy ? { ai: d.approvalWho, ly_do: d.approvalWhy } : null,
      dependsOn: d.dependsOn,
      related: { issue: d.relIssue, pr: d.relPr, viec: d.relTasks, tai_lieu: d.relDocs },
      branch: d.branch,
      source: d.source,
    },
  } as const;
}

export async function createTask(
  projectId: number,
  _: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  const me = await requireUser();
  const parsed = parseTaskForm(form);
  if ("error" in parsed) return { error: parsed.error };
  const key = await createTaskCore({ ...parsed.data, projectId }, me);
  redirect(`/tasks/${key}`);
}

export async function updateTask(
  key: string,
  _: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  const me = await requireUser();
  const parsed = parseTaskForm(form);
  if ("error" in parsed) return { error: parsed.error };
  const expected = String(form.get("expectedUpdatedAt") ?? "");
  const [cur] = await db.select({ updatedAt: tasks.updatedAt }).from(tasks).where(eq(tasks.key, key));
  if (!cur) return { error: "Không tìm thấy việc" };
  if (expected && cur.updatedAt.toISOString() !== expected) {
    const at = cur.updatedAt.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
    return {
      error: `Việc này vừa được sửa lúc ${at} trong khi bạn đang soạn. Chưa lưu gì – nội dung bạn nhập vẫn còn. Mở việc ở tab mới để xem bản mới, hoặc bấm Lưu lần nữa để ghi đè.`,
      conflictAt: cur.updatedAt.toISOString(),
    };
  }
  if (!(await updateTaskCore(key, parsed.data, me))) return { error: "Không tìm thấy việc" };
  refresh();
  return { ok: "Đã lưu" };
}

export async function moveTask(key: string, status: string, position: number) {
  const me = await requireUser();
  if (!STATUSES.some((s) => s.value === status)) throw new Error("Trạng thái lạ");
  const [old] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.key, key));
  if (!old) throw new Error("Không tìm thấy việc");
  const date = today();
  await db
    .update(tasks)
    .set(
      old.status === status
        ? { position }
        : { status, position, updatedOn: date, updatedAt: new Date() },
    )
    .where(eq(tasks.key, key));
  if (old.status !== status) {
    await db
      .insert(taskLogs)
      .values({ taskKey: key, date, text: statusLog(old.status, status, me), userId: me.id });
  }
  refresh();
}

export async function setStatus(key: string, status: string) {
  const [t] = await db.select({ position: tasks.position }).from(tasks).where(eq(tasks.key, key));
  if (t) await moveTask(key, status, t.position);
}

export async function assignTask(key: string, assigneeId: number | null) {
  const me = await requireUser();
  await updateTaskCore(key, { assigneeId }, me);
  refresh();
}

export async function addLog(key: string, form: FormData) {
  const me = await requireUser();
  const text = String(form.get("text") ?? "").trim();
  if (!text) return;
  await db.insert(taskLogs).values({ taskKey: key, date: today(), text, userId: me.id });
  refresh();
}

export async function addComment(key: string, form: FormData) {
  const me = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  await db.insert(comments).values({ taskKey: key, body, userId: me.id });
  refresh();
}

// Chỉ người viết được sửa bình luận của mình
export async function updateComment(id: number, body: string) {
  const me = await requireUser();
  const text = body.trim();
  if (!text) throw new Error("Bình luận trống");
  const [row] = await db
    .update(comments)
    .set({ body: text, editedAt: new Date() })
    .where(and(eq(comments.id, id), eq(comments.userId, me.id)))
    .returning({ id: comments.id });
  if (!row) throw new Error("Chỉ sửa được bình luận của chính mình");
  refresh();
}

// ---- Việc con ----

// Thêm nhanh việc con: lấy mảng / loại / đợt / ưu tiên của việc cha
export async function addSubtask(
  parentKey: string,
  _: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  const me = await requireUser();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "Cần nhập tiêu đề việc con" };
  const [parent] = await db.select().from(tasks).where(eq(tasks.key, parentKey));
  if (!parent) return { error: "Không tìm thấy việc cha" };
  try {
    await createTaskCore(
      {
        title,
        parentKey,
        projectId: parent.projectId,
        area: parent.area,
        type: parent.type,
        sprint: parent.sprint,
        priority: parent.priority,
        status: "moi",
      },
      me,
    );
  } catch (e) {
    if (e instanceof TaskRuleError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: "Đã thêm" };
}

export async function moveSubtask(key: string, subOrder: number) {
  await requireUser();
  await reorderSubtask(key, subOrder);
  refresh();
}

export async function deleteComment(id: number) {
  const me = await requireUser();
  await db
    .delete(comments)
    .where(me.role === "admin" ? eq(comments.id, id) : and(eq(comments.id, id), eq(comments.userId, me.id)));
  refresh();
}

// ---- AR / QD ----

export async function saveRecord(
  projectId: number,
  kind: "risk" | "decision",
  key: string | null,
  _: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  await requireUser();
  const f = Object.fromEntries(form) as Record<string, string>;
  const data: Record<string, unknown> =
    kind === "risk"
      ? {
          tieu_de: (f.tieu_de ?? "").trim(),
          nguon: (f.nguon ?? "").trim(),
          danh_gia: (f.danh_gia ?? "").trim(),
          xem_lai_khi: (f.xem_lai_khi ?? "").trim(),
        }
      : {
          cau_hoi: (f.cau_hoi ?? "").trim(),
          ai: (f.ai ?? "").trim(),
          chan_viec: (f.chan_viec ?? "")
            .split(/[\s,;]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map(normalizeKey),
        };
  if (!(data.tieu_de ?? data.cau_hoi)) return { error: "Cần nhập nội dung" };

  if (key) {
    const [old] = await db.select().from(records).where(eq(records.key, key));
    if (!old) return { error: "Không tìm thấy" };
    // giữ các trường lạ có trong tệp import
    await db
      .update(records)
      .set({ data: { ...old.data, ...data }, updatedAt: new Date() })
      .where(eq(records.key, key));
  } else {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return { error: "Không có dự án này" };
    await db.transaction(async (tx) => {
      const newKey = await nextKey(tx, project, RECORD_KINDS[kind].prefix);
      await tx.insert(records).values({ key: newKey, projectId, kind, data, position: Date.now() % 1e9 });
    });
  }
  refresh();
  return { ok: "Đã lưu" };
}

export async function deleteRecord(key: string) {
  await requireAdmin();
  await db.delete(records).where(eq(records.key, key));
  refresh();
}

// ---- Đợt ----

export async function saveSprint(
  projectId: number,
  originalCode: string | null,
  _: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  await requireUser();
  const code = String(form.get("code") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(code)) {
    return { error: "Mã đợt chỉ gồm chữ, số, dấu - _ . (ví dụ D5-ten-dot)" };
  }
  try {
    if (originalCode) {
      await db
        .update(sprints)
        .set({ code, description })
        .where(and(eq(sprints.projectId, projectId), eq(sprints.code, originalCode)));
    } else {
      await db.insert(sprints).values({ projectId, code, description, position: Date.now() % 1e9 });
    }
  } catch {
    return { error: "Mã đợt đã tồn tại" };
  }
  refresh();
  return { ok: "Đã lưu" };
}

export async function deleteSprint(projectId: number, code: string) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    // việc trong đợt về "chưa xếp đợt"
    await tx
      .update(tasks)
      .set({ sprint: null })
      .where(and(eq(tasks.projectId, projectId), eq(tasks.sprint, code)));
    await tx.delete(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.code, code)));
  });
  refresh();
}
