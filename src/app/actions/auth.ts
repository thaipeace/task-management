"use server";

import { and, count, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invites, sessions, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  hashToken,
  requireUser,
  verifyPassword,
} from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Email không hợp lệ");
const password = z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự");
const name = z.string().trim().min(1, "Cần nhập tên").max(100);

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Cần nhập mật khẩu") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const ok =
    user?.passwordHash && user.active && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "Sai email hoặc mật khẩu" };

  await createSession(user.id);
  redirect("/board");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// Tạo admin đầu tiên – chỉ chạy được khi chưa có người dùng nào và đúng SETUP_SECRET
export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  const secret = process.env.SETUP_SECRET;
  if (!secret) return { error: "Chưa đặt biến môi trường SETUP_SECRET" };
  const parsed = z
    .object({ secret: z.string(), email, name, password })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.secret !== secret) return { error: "Mã thiết lập không đúng" };

  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) return { error: "Đã có người dùng – hãy đăng nhập" };

  const [user] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name,
      role: "admin",
      passwordHash: await hashPassword(parsed.data.password),
    })
    .returning({ id: users.id });
  await createSession(user.id);
  redirect("/admin/import");
}

export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ token: z.string().min(1), name, password, confirm: z.string() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Hai mật khẩu không khớp" };

  const passwordHash = await hashPassword(parsed.data.password);
  const userId = await db.transaction(async (tx) => {
    // đánh dấu đã dùng ngay trong câu update để link chỉ dùng được một lần
    const [invite] = await tx
      .update(invites)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(invites.tokenHash, hashToken(parsed.data.token)),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!invite) return null;

    const [existing] = await tx.select().from(users).where(eq(users.email, invite.email)).limit(1);
    if (existing) {
      // link mời cho email đã có = đặt lại mật khẩu; đăng xuất mọi phiên cũ
      await tx
        .update(users)
        .set({ name: parsed.data.name, passwordHash, active: true })
        .where(eq(users.id, existing.id));
      await tx.delete(sessions).where(eq(sessions.userId, existing.id));
      await tx.delete(invites).where(and(eq(invites.email, invite.email), isNull(invites.usedAt)));
      return existing.id;
    }
    const [created] = await tx
      .insert(users)
      .values({ email: invite.email, name: parsed.data.name, role: invite.role, passwordHash })
      .returning({ id: users.id });
    return created.id;
  });

  if (!userId) return { error: "Link mời không còn hiệu lực (đã dùng, đã huỷ hoặc hết hạn)" };
  await createSession(userId);
  redirect("/board");
}

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = z
    .object({
      name,
      current: z.string(),
      password: z.union([z.literal(""), password]),
      confirm: z.string(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { current, confirm } = parsed.data;

  const set: { name: string; passwordHash?: string } = { name: parsed.data.name };
  if (parsed.data.password) {
    if (parsed.data.password !== confirm) return { error: "Hai mật khẩu mới không khớp" };
    const [row] = await db.select().from(users).where(eq(users.id, me.id));
    if (!row.passwordHash || !(await verifyPassword(current, row.passwordHash))) {
      return { error: "Mật khẩu hiện tại không đúng" };
    }
    set.passwordHash = await hashPassword(parsed.data.password);
  }
  await db.update(users).set(set).where(eq(users.id, me.id));
  return { ok: set.passwordHash ? "Đã lưu tên và mật khẩu mới" : "Đã lưu" };
}
