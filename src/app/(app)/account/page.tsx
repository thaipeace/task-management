import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { desc, eq } from "drizzle-orm";
import { ApiTokens } from "@/components/api-tokens";
import { AccountForm } from "@/components/auth-forms";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Tài khoản" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Tài khoản" />
      <Suspense fallback={<Loading />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const me = await requireUser();
  const tokens = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, me.id))
    .orderBy(desc(apiTokens.createdAt));
  const fmt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return (
    <div className="space-y-4">
      <AccountForm name={me.name} email={me.email} />
      <ApiTokens
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          prefix: t.prefix,
          createdAt: fmt.format(t.createdAt),
          lastUsedAt: t.lastUsedAt ? fmt.format(t.lastUsedAt) : null,
        }))}
      />
      <form action={logout}>
        <button className="btn-secondary">Đăng xuất</button>
      </form>
    </div>
  );
}
