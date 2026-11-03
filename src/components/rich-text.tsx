import Link from "next/link";

const ID = /\b([A-Z]{2,4}-\d{3,})\b/g;

export function idHref(id: string) {
  return /^(AR|QD)-/.test(id) ? `/records#${id}` : `/tasks/${id}`;
}

// Hiện văn bản, biến các id dạng BE-001 / QD-002 thành liên kết
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(ID);
  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Link key={i} href={idHref(p)} className="font-medium text-brand hover:underline">
            {p}
          </Link>
        ) : (
          p
        ),
      )}
    </span>
  );
}

export function IdLinks({ ids }: { ids: string[] }) {
  if (!ids.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <Link
          key={id}
          href={idHref(id)}
          className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-brand hover:underline"
        >
          {id}
        </Link>
      ))}
    </span>
  );
}
