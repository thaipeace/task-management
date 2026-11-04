"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invites, sessions, users } from "@/db/schema";
import { hashToken, newToken, requireAdmin } from "@/lib/auth";
import { importBacklog, type ImportSummary } from "@/lib/backlog";
import { getProjectById } from "@/lib/projects";

const INVITE_DAYS = 7;

export type InviteState = { error?: string; token?: string; email?: string } | undefined;

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const me = await requireAdmin();
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
      role: z.enum(["admin", "member"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const token = newToken();
  await db.insert(invites).values({
    tokenHash: hashToken(token),
    email: parsed.data.email,
    role: parsed.data.role,
    createdById: me.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  refresh();
  // token gốc chỉ trả về một lần – DB chỉ giữ bản băm
  return { token, email: parsed.data.email };
}

export async function revokeInvite(id: number) {
  await requireAdmin();
  await db.delete(invites).where(eq(invites.id, id));
  refresh();
}

export async function setUserRole(userId: number, role: "admin" | "member") {
  const me = await requireAdmin();
  if (userId === me.id) throw new Error("Không tự đổi quyền của mình");
  await db.update(users).set({ role }).where(eq(users.id, userId));
  refresh();
}

export async function setUserActive(userId: number, active: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) throw new Error("Không tự khoá tài khoản của mình");
  await db.update(users).set({ active }).where(and(eq(users.id, userId), ne(users.id, me.id)));
  if (!active) await db.delete(sessions).where(eq(sessions.userId, userId));
  refresh();
}

export type ImportState = { error?: string; summary?: ImportSummary } | undefined;

export async function importAction(_: ImportState, form: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = form.get("file");
  const mode = form.get("mode") === "replace" ? "replace" : "merge";
  const project = await getProjectById(Number(form.get("projectId")));
  if (!project) return { error: "Chọn dự án để import" };
  if (!(file instanceof File) || file.size === 0) return { error: "Chọn tệp backlog.json" };
  if (file.size > 3.5 * 1024 * 1024) return { error: "Tệp quá lớn (tối đa 3.5 MB)" };

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: "Tệp không phải JSON hợp lệ" };
  }
  try {
    const summary = await importBacklog(json, mode, project);
    refresh();
    return { summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import lỗi" };
  }
}
