"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { goals, sprints, tasks } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { normalizeKey } from "@/lib/task-keys";
import { GOAL_STATUSES, upsertWeekly } from "@/lib/weekly";
import type { TaskFormState } from "./tasks";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dạng YYYY-MM-DD");

const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Cần nêu mục tiêu"),
    measure: z.string().trim().default(""),
    ownerId: z.coerce.number().int().positive().nullable().catch(null),
    startOn: day,
    dueOn: day,
    sprint: z
      .string()
      .trim()
      .transform((s) => s || null),
    taskKeys: z
      .string()
      .default("")
      .transform((s) => [...new Set(s.split(/[\s,;]+/).filter(Boolean).map(normalizeKey))]),
    status: z.enum(GOAL_STATUSES.map((s) => s.value) as [string, ...string[]]),
  })
  .refine((g) => g.dueOn >= g.startOn, { message: "Hạn phải sau ngày bắt đầu", path: ["dueOn"] });

export async function saveGoal(projectId: number, id: number | null, _: TaskFormState, form: FormData): Promise<TaskFormState> {
  await requireUser();
  const parsed = goalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const g = parsed.data;
  if (g.sprint) {
    const [s] = await db
      .select({ code: sprints.code })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.code, g.sprint)));
    if (!s) return { error: `Không có đợt ${g.sprint}` };
  }
  if (g.taskKeys.length) {
    const found = await db
      .select({ key: tasks.key })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.key, g.taskKeys)));
    const missing = g.taskKeys.filter((k) => !found.some((f) => f.key === k));
    if (missing.length) return { error: `Không có việc ${missing.join(", ")} trong dự án` };
  }
  if (id) {
    await db
      .update(goals)
      .set({ ...g, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.projectId, projectId)));
  } else {
    await db.insert(goals).values({ ...g, projectId, position: Date.now() % 1e9 });
  }
  refresh();
  return { ok: "Đã lưu" };
}

export async function deleteGoal(id: number) {
  await requireAdmin();
  await db.delete(goals).where(eq(goals.id, id));
  refresh();
}

// Sửa lời báo cáo tuần trên web (Claude ghi qua API PUT /api/v1/weekly)
export async function saveWeekly(projectId: number, week: string, _: TaskFormState, form: FormData): Promise<TaskFormState> {
  const me = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Báo cáo trống" };
  await upsertWeekly(projectId, week, body, me.id);
  refresh();
  return { ok: "Đã lưu báo cáo tuần" };
}
