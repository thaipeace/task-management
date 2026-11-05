import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// SIA-001, SIA-010a, QD-002, ABC-QD-001 (và id cũ BE-001 – trang việc tự chuyển sang id mới)
const ID = /\b((?:[A-Z][A-Z0-9]{1,9}-)?[A-Z]{2,4}-\d{3,}[a-z]?)(?![\w-])/g;

export function idHref(id: string) {
  return /(^|-)(AR|QD)-\d+$/.test(id) ? `/records#${id}` : `/tasks/${id}`;
}

// ---- Markdown ----
// Mọi ô văn bản (mô tả, rủi ro, bình luận, nhật ký, AR/QD…) là Markdown kiểu GitHub:
// **đậm**, *nghiêng*, `code`, ```khối code```, [link](https://…), danh sách, bảng. Xuống dòng một lần = xuống dòng.
// HTML gõ vào hiện nguyên chữ, không chạy (react-markdown không render HTML thô).

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

// Biến id việc trong chữ thường thành liên kết; bỏ qua code và chữ đã nằm trong link
function remarkTaskIds() {
  const walk = (node: MdNode) => {
    if (!node.children || node.type === "link" || node.type === "linkReference") return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) {
        walk(child);
        return [child];
      }
      const parts = child.value.split(ID);
      if (parts.length === 1) return [child];
      return parts
        .map((p, i): MdNode | null =>
          i % 2 === 1
            ? { type: "link", url: idHref(p), children: [{ type: "text", value: p }] }
            : p
              ? { type: "text", value: p }
              : null,
        )
        .filter((n): n is MdNode => n !== null);
    });
  };
  return (tree: MdNode) => walk(tree);
}

const components: Components = {
  a({ href = "", children }) {
    if (href.startsWith("/")) {
      return (
        <Link href={href} className="font-medium text-brand hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className="text-brand underline underline-offset-2">
        {children}
      </a>
    );
  },
};

// trong dòng ngắn (nhật ký, mục danh sách): bỏ thẻ <p> để không xuống dòng thừa
const inlineComponents: Components = {
  ...components,
  p: ({ children }) => <>{children}</>,
};

export function RichText({
  text,
  className = "",
  inline = false,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={`md ${inline ? "md-inline" : ""} ${className}`}>
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks, remarkTaskIds]} components={inline ? inlineComponents : components}>
        {text}
      </Markdown>
    </Tag>
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
