import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { AccountForm } from "@/components/auth-forms";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Tài khoản" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Tài khoản" />
      <Suspense fallback={<Loading />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const me = await requireUser();
  return (
    <div className="space-y-4">
      <AccountForm name={me.name} email={me.email} />
      <form action={logout}>
        <button className="btn-secondary">Đăng xuất</button>
      </form>
    </div>
  );
}
