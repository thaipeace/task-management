import { count } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SetupForm } from "@/components/auth-forms";
import { Loading } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Thiết lập" };

export default function SetupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SetupContent />
    </Suspense>
  );
}

async function SetupContent() {
  await connection();
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) {
    return (
      <p className="text-sm">
        Đã thiết lập xong.{" "}
        <Link href="/login" className="text-brand underline">
          Đăng nhập
        </Link>
      </p>
    );
  }
  if (!process.env.SETUP_SECRET) {
    return (
      <p className="text-sm text-slate-600">
        Đặt biến môi trường <code className="rounded bg-slate-100 px-1">SETUP_SECRET</code> rồi tải lại trang để
        tạo quản trị viên đầu tiên.
      </p>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Tạo quản trị viên đầu tiên</h1>
      <p className="mb-5 text-sm text-slate-500">Chỉ làm được một lần, khi chưa có người dùng nào.</p>
      <SetupForm />
    </>
  );
}
