import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={<aside className="w-full shrink-0 bg-white md:w-60 md:border-r md:border-slate-200" />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6">{children}</main>
    </div>
  );
}
