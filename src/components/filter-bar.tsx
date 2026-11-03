"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AREAS, PRIORITIES, TYPES } from "@/lib/constants";
import type { TaskFilters } from "@/lib/queries";

type Props = {
  filters: TaskFilters;
  sprints: { code: string }[];
  users: { id: number; name: string }[];
};

export function FilterBar({ filters, sprints, users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  const apply = (patch: Partial<TaskFilters>) => {
    const next = { ...filters, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  };

  // tìm kiếm: chờ người dùng ngừng gõ
  useEffect(() => {
    if (q === (filters.q ?? "")) return;
    const t = setTimeout(() => apply({ q: q || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const select = (
    key: keyof TaskFilters,
    placeholder: string,
    options: { value: string; label: string }[],
  ) => (
    <select
      value={filters[key] ?? ""}
      onChange={(e) => apply({ [key]: e.target.value || undefined })}
      className={`input w-auto py-1 ${filters[key] ? "border-brand bg-blue-50 text-brand" : ""}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const active = Object.values(filters).some(Boolean);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo id, tiêu đề, mô tả…"
        className="input w-60"
      />
      {select("sprint", "Mọi đợt", [
        ...sprints.map((s) => ({ value: s.code, label: s.code })),
        { value: "none", label: "(Chưa xếp đợt)" },
      ])}
      {select("area", "Mọi mảng", AREAS.map((a) => ({ value: a.value, label: a.value })))}
      {select("priority", "Mọi ưu tiên", PRIORITIES.map((p) => ({ value: p.value, label: p.label })))}
      {select("type", "Mọi loại", TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` })))}
      {select("assignee", "Mọi người", [
        { value: "me", label: "Việc của tôi" },
        { value: "none", label: "Chưa giao" },
        ...users.map((u) => ({ value: String(u.id), label: u.name })),
      ])}
      {active && (
        <button
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname));
          }}
          className="btn-ghost text-xs"
        >
          Xoá lọc
        </button>
      )}
      {pending && <span className="text-xs text-slate-400">Đang lọc…</span>}
    </div>
  );
}
