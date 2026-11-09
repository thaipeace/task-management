"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/report", label: "Tổng quan" },
  { href: "/report/weekly", label: "Báo cáo tuần" },
  { href: "/report/releases", label: "Dev release" },
];

export function ReportTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 ${
            pathname === t.href ? "border-brand font-semibold text-brand" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
