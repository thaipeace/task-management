"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { counters, devReleases, goals, meta, projects, records, sprints, tasks, weeklyReports } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { AREAS, RECORD_KINDS } from "@/lib/constants";
import { PROJECT_CODE, PROJECT_COOKIE, getProjectByCode } from "@/lib/projects";

export type ProjectFormState = { error?: string; ok?: string } | undefined;

// Đổi dự án đang xem (lưu trong cookie)
export async function switchProject(code: string) {
  await requireUser();
  const project = await getProjectByCode(code);
  if (!project) throw new Error("Không có dự án này");
  (await cookies()).set(PROJECT_COOKIE, project.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 86_400,
  });
  refresh();
}

// mã dự án trùng tiền tố mảng / AR / QD sẽ làm id khó đọc (BE-BE-001)
const RESERVED = [...AREAS.map((a) => a.value), ...Object.values(RECORD_KINDS).map((r) => r.prefix)] as string[];

const fields = {
  name: z.string().trim().min(1, "Cần nhập tên dự án").max(100),
  description: z.string().trim().max(2000).default(""),
};

export async function createProject(_: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin();
  const parsed = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(PROJECT_CODE, "Mã dự án: 2–10 ký tự chữ in hoa / số, bắt đầu bằng chữ (vd. SIA)")
        .refine((c) => !RESERVED.includes(c), "Mã này trùng tiền tố mảng (BE, FE…) – chọn mã khác"),
      ...fields,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { code, name, description } = parsed.data;

  if (await getProjectByCode(code)) return { error: `Đã có dự án ${code}` };
  // id việc của dự án mới mang tiền tố mã dự án để không đụng id của dự án khác
  await db.insert(projects).values({ code, name, description, keyPrefix: `${code}-` });
  refresh();
  return { ok: `Đã tạo dự án ${code}` };
}

export async function updateProject(
  id: number,
  _: ProjectFormState,
  form: FormData,
): Promise<ProjectFormState> {
  await requireAdmin();
  const parsed = z.object(fields).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(projects).set(parsed.data).where(eq(projects.id, id));
  refresh();
  return { ok: "Đã lưu" };
}

// Chỉ xoá được dự án chưa có việc / AR / QD nào và không phải dự án duy nhất
export async function deleteProject(id: number) {
  await requireAdmin();
  const all = await db.select({ id: projects.id }).from(projects);
  if (all.length <= 1) throw new Error("Không xoá dự án duy nhất");
  const [task] = await db.select({ key: tasks.key }).from(tasks).where(eq(tasks.projectId, id)).limit(1);
  const [record] = await db.select({ key: records.key }).from(records).where(eq(records.projectId, id)).limit(1);
  if (task || record) throw new Error("Dự án còn việc hoặc AR/QD – không xoá được");
  await db.transaction(async (tx) => {
    await tx.delete(weeklyReports).where(eq(weeklyReports.projectId, id));
    await tx.delete(devReleases).where(eq(devReleases.projectId, id));
    await tx.delete(goals).where(eq(goals.projectId, id));
    await tx.delete(sprints).where(eq(sprints.projectId, id));
    await tx.delete(counters).where(eq(counters.projectId, id));
    await tx.delete(meta).where(eq(meta.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
  });
  refresh();
}
