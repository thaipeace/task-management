import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Loading } from "@/components/ui";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { hashToken } from "@/lib/auth";

// URL chứa token: không gửi qua Referer, không cho lập chỉ mục
export const metadata: Metadata = { title: "Đặt lại mật khẩu", referrer: "no-referrer", robots: { index: false } };

export default function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ResetContent params={params} />
    </Suspense>
  );
}

async function ResetContent({ params }: Pick<PageProps<"/reset-password/[token]">, "params">) {
  const { token } = await params;
  const [reset] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, sql`now()`),
      ),
    )
    .limit(1);

  if (!reset) {
    return (
      <>
        <h1 className="mb-2 text-lg font-semibold">Link không còn hiệu lực</h1>
        <p className="mb-4 text-sm text-slate-600">Link đã được dùng hoặc đã hết hạn.</p>
        <Link href="/forgot-password" className="btn-secondary">
          Yêu cầu link mới
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Đặt lại mật khẩu</h1>
      <p className="mb-5 text-sm text-slate-500">Sau khi đổi, mọi phiên đăng nhập cũ sẽ bị đăng xuất.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
