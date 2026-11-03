import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/auth-forms";
import { Loading } from "@/components/ui";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { hashToken } from "@/lib/auth";

export const metadata: Metadata = { title: "Nhận lời mời" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const [invite] = await db
    .select({ email: invites.email })
    .from(invites)
    .where(
      and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedAt), gt(invites.expiresAt, sql`now()`)),
    )
    .limit(1);

  if (!invite) {
    return (
      <>
        <h1 className="mb-2 text-lg font-semibold">Link không còn hiệu lực</h1>
        <p className="mb-4 text-sm text-slate-600">
          Link mời đã được dùng, đã bị huỷ hoặc đã hết hạn. Hãy xin quản trị viên link mới.
        </p>
        <Link href="/login" className="btn-secondary">
          Về trang đăng nhập
        </Link>
      </>
    );
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email));
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">{existing ? "Đặt lại mật khẩu" : "Chào mừng!"}</h1>
      <p className="mb-5 text-sm text-slate-500">
        {existing
          ? "Đặt mật khẩu mới cho tài khoản của bạn. Các phiên đăng nhập cũ sẽ bị đăng xuất."
          : "Đặt tên và mật khẩu – lần sau đăng nhập bằng email + mật khẩu này."}
      </p>
      <AcceptInviteForm token={token} email={invite.email} />
    </>
  );
}
