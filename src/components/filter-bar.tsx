"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AREAS, PRIORITIES, TYPES } from "@/lib/constants";
import type { TaskFilters } from "@/lib/queries";

type Props = {
  filters: TaskFilters;
  sprints: { code: string }[];
  users: { id: number; name: string }[];
  subDefault?: boolean; // "Hiện việc con" khi URL không có ?sub
};

type ListKey = Exclude<keyof TaskFilters, "q" | "sub">;
type Option = { value: string; label: string; short?: string };

export function FilterBar({ filters: current, sprints, users, subDefault = true }: Props) {
  const router = useRouter();
  // hiện lựa chọn ngay khi bấm; bấm liên tiếp cộng dồn thay vì ghi đè nhau khi URL chưa kịp đổi
  const [filters, setFilters] = useOptimistic(current);
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  const apply = (patch: Partial<TaskFilters>) => {
    const next = { ...filters, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (k === "sub") {
        if (v !== subDefault) sp.set("sub", v ? "1" : "0");
        continue;
      }
      const value = Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "";
      if (value) sp.set(k, value);
    }
    // dấu phẩy giữ nguyên cho URL dễ đọc: ?area=BE,FE
    const qs = sp.toString().replaceAll("%2C", ",");
    startTransition(() => {
      setFilters(next);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    });
  };

  // tìm kiếm: chờ người dùng ngừng gõ
  useEffect(() => {
    if (q === (filters.q ?? "")) return;
    const t = setTimeout(() => apply({ q: q || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const multi = (key: ListKey, label: string, options: Option[]) => (
    <MultiSelect
      label={label}
      options={options}
      selected={filters[key]}
      onChange={(values) => apply({ [key]: values })}
    />
  );

  const active =
    !!filters.q || filters.sub !== subDefault || (["sprint", "area", "priority", "type", "assignee"] as const).some((k) => filters[k].length);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo id, tiêu đề, mô tả…"
        className="input w-60"
      />
      {multi("sprint", "Đợt", [
        ...sprints.map((s) => ({ value: s.code, label: s.code })),
        { value: "none", label: "(Chưa xếp đợt)", short: "chưa xếp" },
      ])}
      {multi("area", "Mảng", AREAS.map((a) => ({ value: a.value, label: a.label, short: a.value })))}
      {multi(
        "priority",
        "Ưu tiên",
        PRIORITIES.map((p) => ({ value: p.value, label: p.label, short: p.value })),
      )}
      {multi("type", "Loại", TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}`, short: t.label })))}
      {multi("assignee", "Người làm", [
        { value: "me", label: "Việc của tôi", short: "tôi" },
        { value: "none", label: "Chưa giao", short: "chưa giao" },
        ...users.map((u) => ({ value: String(u.id), label: u.name })),
      ])}
      <label className="flex items-center gap-1.5 px-1 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.sub}
          onChange={(e) => apply({ sub: e.target.checked })}
          className="accent-brand"
        />
        Hiện việc con
      </label>
      {active && (
        <button
          onClick={() => {
            setQ("");
            startTransition(() => {
              setFilters({ sprint: [], area: [], priority: [], type: [], assignee: [], sub: subDefault });
              router.replace(pathname);
            });
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

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // bấm ra ngoài hoặc Esc thì đóng
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const names = options.filter((o) => selected.includes(o.value)).map((o) => o.short ?? o.label);
  const summary = names.length === 0 ? "Tất cả" : names.length <= 2 ? names.join(", ") : `${names.length} mục`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`input flex w-auto items-center gap-1.5 py-1 ${
          selected.length ? "border-brand bg-blue-50 text-brand" : ""
        }`}
      >
        <span className="text-slate-500">{label}:</span>
        <span className="max-w-40 truncate font-medium">{summary}</span>
        <span className="text-[10px] text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-80 min-w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-brand"
              />
              <span className="whitespace-nowrap">{o.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-slate-100 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      )}
    </div>
  );
}
