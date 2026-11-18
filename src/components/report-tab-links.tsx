"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// đường dẫn tương đối trong /<mã dự án>/report
const TABS = [
  { href: "", label: "Tổng quan" },
  { href: "/weekly", label: "Báo cáo tuần" },
  { href: "/releases", label: "Dev release" },
];

// Tổng quan chỉ admin xem
export function ReportTabLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const root = `/${pathname.split("/")[1]}/report`;
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
      {TABS.filter((t) => isAdmin || t.href !== "").map((t) => (
        <Link
          key={t.href}
          href={root + t.href}
          className={`-mb-px border-b-2 px-3 py-2 ${
            (t.href === "" ? pathname === root : pathname.startsWith(root + t.href)) ? "border-brand font-semibold text-brand" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
