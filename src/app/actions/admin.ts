"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invites, sessions, users } from "@/db/schema";
import { hashToken, newToken, requireAdmin } from "@/lib/auth";
import { importBacklog, type ImportSummary } from "@/lib/backlog";
import { getProjectById } from "@/lib/projects";

const INVITE_DAYS = 7;
const RESET_HOURS = 24;

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

// Link đặt lại mật khẩu: mật khẩu cũ vẫn dùng được cho tới khi người dùng hoàn tất trên trang link
export async function createResetLink(userId: number) {
  const me = await requireAdmin();
  if (userId === me.id) throw new Error("Tự đổi mật khẩu ở trang Tài khoản");
  const [user] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.active, true)));
  if (!user) throw new Error("Tài khoản không tồn tại hoặc đang khoá");

  const token = newToken();
  await db.transaction(async (tx) => {
    // mỗi người chỉ một link còn hiệu lực
    await tx.delete(invites).where(and(eq(invites.email, user.email), isNull(invites.usedAt)));
    await tx.insert(invites).values({
      tokenHash: hashToken(token),
      email: user.email,
      role: user.role,
      createdById: me.id,
      expiresAt: new Date(Date.now() + RESET_HOURS * 3_600_000),
    });
  });
  refresh();
  return { token, email: user.email };
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
  const [user] = await db
    .update(users)
    .set({ active })
    .where(and(eq(users.id, userId), ne(users.id, me.id)))
    .returning({ email: users.email });
  if (!active) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    // link còn chờ sẽ mở khoá lại tài khoản khi dùng – phải bỏ cùng lúc khoá
    if (user) await db.delete(invites).where(and(eq(invites.email, user.email), isNull(invites.usedAt)));
  }
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
