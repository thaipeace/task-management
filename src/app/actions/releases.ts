"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { releaseComments } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getProjectByCode } from "@/lib/projects";
import { approveDevRelease, updateReleaseText } from "@/lib/releases";
import { TaskRuleError } from "@/lib/task-service";

type Result = { ok?: string; error?: string };

async function project(code: string) {
  const p = await getProjectByCode(code);
  if (!p) throw new TaskRuleError("Không có dự án này");
  return p;
}

// lỗi trả về dạng chữ (bản production giấu nội dung lỗi ném ra từ server action)
async function guard(work: () => Promise<string>): Promise<Result> {
  try {
    const ok = await work();
    refresh();
    return { ok };
  } catch (e) {
    if (e instanceof TaskRuleError) return { error: e.message };
    throw e;
  }
}

// Nút Duyệt (chỉ admin): đợt đã release xong – bắt buộc kèm nhận xét duyệt
export async function approveRelease(projectCode: string, version: string, comment: string): Promise<Result> {
  const me = await requireAdmin();
  return guard(async () => {
    const text = comment.trim();
    if (!text) throw new TaskRuleError("Cần ghi nhận xét duyệt (phản hồi, quyết định, tài liệu…)");
    const moved = await approveDevRelease((await project(projectCode)).id, version, me, text);
    return `Đã duyệt ${version} – ${moved.length} việc chuyển sang Released`;
  });
}

export async function addReleaseComment(projectCode: string, version: string, form: FormData) {
  const me = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  const p = await project(projectCode);
  await db.insert(releaseComments).values({ projectId: p.id, version, body, userId: me.id });
  refresh();
}

// người viết sửa được bình luận của mình; admin sửa được mọi bình luận (kể cả nhận xét duyệt)
export async function updateReleaseComment(id: number, body: string) {
  const me = await requireUser();
  const text = body.trim();
  if (!text) throw new Error("Bình luận trống");
  const [row] = await db
    .update(releaseComments)
    .set({ body: text, editedAt: new Date() })
    .where(me.role === "admin" ? eq(releaseComments.id, id) : and(eq(releaseComments.id, id), eq(releaseComments.userId, me.id)))
    .returning({ id: releaseComments.id });
  if (!row) throw new Error("Chỉ sửa được bình luận của chính mình");
  refresh();
}

export async function deleteReleaseComment(id: number) {
  const me = await requireUser();
  await db
    .delete(releaseComments)
    .where(me.role === "admin" ? eq(releaseComments.id, id) : and(eq(releaseComments.id, id), eq(releaseComments.userId, me.id)));
  refresh();
}

export async function saveReleaseText(projectCode: string, version: string, field: "body" | "notes", text: string): Promise<Result> {
  const me = await requireAdmin();
  return guard(async () => {
    await updateReleaseText((await project(projectCode)).id, version, field, text.trim(), me.id);
    return field === "body" ? "Đã lưu nhận xét chung" : "Đã lưu ghi chú";
  });
}
