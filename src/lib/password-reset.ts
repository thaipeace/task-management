import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { hashToken, newToken } from "./auth";

const TTL_MINUTES = 30;
// chặn gửi dồn thư vào hộp mail của một người
const MIN_GAP_MS = 60_000;
const MAX_PER_HOUR = 5;

// Lấy từ biến môi trường, không lấy từ header Host: kẻ tấn công đổi được Host để link trong thư trỏ về máy của họ
function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Chưa đặt APP_URL");
}

async function sendMail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("Chưa đặt RESEND_API_KEY");
    console.log(`[mail – chưa cấu hình, chỉ in ra] tới ${to}: ${subject}\n${text}`);
    return;
  }
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("Chưa đặt MAIL_FROM");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend trả ${res.status}: ${await res.text()}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendPasswordReset(email: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.email, email), eq(users.active, true)))
    .limit(1);
  if (!user) return;

  const lastHour = await db
    .select({ createdAt: passwordResets.createdAt })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, new Date(Date.now() - 3_600_000))));
  if (lastHour.length >= MAX_PER_HOUR || lastHour.some((r) => Date.now() - r.createdAt.getTime() < MIN_GAP_MS)) return;

  const token = newToken();
  const tokenHash = hashToken(token);
  await db.insert(passwordResets).values({
    tokenHash,
    userId: user.id,
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
  });

  const link = `${appUrl()}/reset-password/${token}`;
  try {
    await sendMail(
      email,
      "Đặt lại mật khẩu Task Board",
      `<p>Chào ${escapeHtml(user.name)},</p>
<p>Bấm vào link dưới đây để đặt mật khẩu mới. Link dùng được một lần, hết hạn sau ${TTL_MINUTES} phút.</p>
<p><a href="${link}">Đặt lại mật khẩu</a></p>
<p>Nếu bạn không yêu cầu, hãy bỏ qua thư này – mật khẩu của bạn không đổi.</p>`,
      `Chào ${user.name},\n\nMở link dưới đây để đặt mật khẩu mới. Link dùng được một lần, hết hạn sau ${TTL_MINUTES} phút.\n\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này – mật khẩu của bạn không đổi.\n`,
    );
  } catch (e) {
    // thư không đi được thì không tính vào giới hạn, người dùng thử lại được ngay
    await db.delete(passwordResets).where(eq(passwordResets.tokenHash, tokenHash));
    throw e;
  }
}
