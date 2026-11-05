"use client";

import { useRef, useState } from "react";
import { RichText } from "./rich-text";

// Ô soạn thảo Markdown: thanh công cụ, phím tắt (⌘/Ctrl + B, I, K, E), Enter nối tiếp danh sách,
// dán URL lên chữ đang chọn thành link, tab Xem trước. Giá trị gửi đi vẫn là chữ thường (Markdown)
// nên form, server action và API không phải đổi gì.

type Props = {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  // "line": ô mỗi dòng một mục – chỉ định dạng trong dòng, không có danh sách / khối code
  variant?: "full" | "line";
  mono?: boolean;
  onEscape?: () => void;
};

type Edit = { text: string; selStart: number; selEnd: number };

type ToolId = "bold" | "italic" | "strike" | "code" | "link" | "heading" | "bullet" | "number" | "task" | "quote";

const TOOLS: { id: ToolId; label: string; title: string; className?: string; inline?: boolean }[] = [
  { id: "bold", label: "B", title: "Đậm (⌘/Ctrl B)", className: "font-bold", inline: true },
  { id: "italic", label: "I", title: "Nghiêng (⌘/Ctrl I)", className: "italic", inline: true },
  { id: "strike", label: "S", title: "Gạch ngang", className: "line-through", inline: true },
  { id: "code", label: "</>", title: "Code (⌘/Ctrl E) – chọn nhiều dòng thành khối code", className: "font-mono", inline: true },
  { id: "link", label: "🔗", title: "Link (⌘/Ctrl K) – hoặc chọn chữ rồi dán URL", inline: true },
  { id: "heading", label: "H", title: "Tiêu đề nhỏ", className: "font-semibold" },
  { id: "bullet", label: "•", title: "Danh sách" },
  { id: "number", label: "1.", title: "Danh sách đánh số" },
  { id: "task", label: "☐", title: "Việc cần tích" },
  { id: "quote", label: "❝", title: "Trích dẫn" },
];

const URL_RE = /^https?:\/\/\S+$/;

export function MarkdownField({
  name,
  defaultValue = "",
  rows = 4,
  placeholder,
  required,
  autoFocus,
  variant = "full",
  mono,
  onEscape,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Thay đoạn [start, end) bằng text rồi chọn lại – dùng execCommand để ⌘Z hoàn tác được
  function replace(start: number, end: number, e: Edit) {
    const el = ref.current!;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = document.execCommand?.("insertText", false, e.text);
    if (!ok) el.setRangeText(e.text, start, end, "end");
    el.setSelectionRange(start + e.selStart, start + e.selEnd);
  }

  function wrap(before: string, after: string, filler: string) {
    const el = ref.current!;
    const { selectionStart: s, selectionEnd: t, value } = el;
    const sel = value.slice(s, t);
    // đã bọc sẵn thì gỡ ra
    if (value.slice(s - before.length, s) === before && value.slice(t, t + after.length) === after) {
      replace(s - before.length, t + after.length, { text: sel, selStart: 0, selEnd: sel.length });
      return;
    }
    const inner = sel || filler;
    replace(s, t, { text: before + inner + after, selStart: before.length, selEnd: before.length + inner.length });
  }

  function linePrefix(prefix: (i: number) => string) {
    const el = ref.current!;
    const { selectionStart: s, selectionEnd: t, value } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const endIdx = value.indexOf("\n", t);
    const end = endIdx === -1 ? value.length : endIdx;
    const lines = value.slice(start, end).split("\n");
    const has = lines.every((l, i) => l.startsWith(prefix(i)));
    const text = lines.map((l, i) => (has ? l.slice(prefix(i).length) : prefix(i) + l)).join("\n");
    replace(start, end, { text, selStart: 0, selEnd: text.length });
  }

  function link() {
    const el = ref.current!;
    const { selectionStart: s, selectionEnd: t, value } = el;
    const sel = value.slice(s, t);
    if (URL_RE.test(sel)) {
      replace(s, t, { text: `[](${sel})`, selStart: 1, selEnd: 1 });
    } else {
      const label = sel || "chữ hiện ra";
      const text = `[${label}](https://)`;
      replace(s, t, { text, selStart: label.length + 3, selEnd: text.length - 1 });
    }
  }

  function code() {
    const el = ref.current!;
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    if (variant === "full" && sel.includes("\n")) wrap("```\n", "\n```", "");
    else wrap("`", "`", "code");
  }

  // Enter trong danh sách: thêm dấu đầu dòng; dòng chỉ còn dấu thì bỏ dấu (thoát danh sách)
  function continueList(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: t, value } = el;
    if (s !== t) return;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const line = value.slice(start, s);
    const m = /^(\s*)([-*+] \[[ x]\] |[-*+] |(\d+)\. |> )/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (line === m[0]) {
      replace(start, s, { text: "", selStart: 0, selEnd: 0 });
      return;
    }
    const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace("[x]", "[ ]");
    const text = `\n${m[1]}${marker}`;
    replace(s, s, { text, selStart: text.length, selEnd: text.length });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && onEscape) return onEscape();
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      const act = { b: () => wrap("**", "**", "chữ đậm"), i: () => wrap("*", "*", "chữ nghiêng"), k: link, e: code }[k];
      if (act) {
        e.preventDefault();
        act();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !mod && variant === "full") continueList(e);
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const url = e.clipboardData.getData("text/plain").trim();
    const el = e.currentTarget;
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    if (sel && !sel.includes("\n") && URL_RE.test(url) && !URL_RE.test(sel)) {
      e.preventDefault();
      replace(el.selectionStart, el.selectionEnd, { text: `[${sel}](${url})`, selStart: 0, selEnd: sel.length + url.length + 4 });
    }
  }

  function runTool(id: ToolId) {
    const actions: Record<ToolId, () => void> = {
      bold: () => wrap("**", "**", "chữ đậm"),
      italic: () => wrap("*", "*", "chữ nghiêng"),
      strike: () => wrap("~~", "~~", "chữ gạch"),
      code,
      link,
      heading: () => linePrefix(() => "### "),
      bullet: () => linePrefix(() => "- "),
      number: () => linePrefix((i) => `${i + 1}. `),
      task: () => linePrefix(() => "- [ ] "),
      quote: () => linePrefix(() => "> "),
    };
    actions[id]();
  }

  const tools = variant === "full" ? TOOLS : TOOLS.filter((t) => t.inline);

  return (
    <div className="rounded-md border border-slate-300 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-1 py-0.5">
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            disabled={preview !== null}
            onMouseDown={(e) => e.preventDefault()} // giữ vùng chọn trong ô
            onClick={() => runTool(t.id)}
            className={`min-w-7 rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 ${t.className ?? ""}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto flex text-xs">
          <button
            type="button"
            onClick={() => setPreview(null)}
            className={`rounded px-2 py-0.5 ${preview === null ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
          >
            Viết
          </button>
          <button
            type="button"
            onClick={() => setPreview(ref.current?.value ?? "")}
            className={`rounded px-2 py-0.5 ${preview !== null ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
          >
            Xem trước
          </button>
        </span>
      </div>
      {/* ô nhập luôn nằm trong form (ẩn khi xem trước) để giá trị vẫn được gửi */}
      <textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onInvalid={() => setPreview(null)} // ô bắt buộc mà trống: quay về Viết để trình duyệt chỉ ra
        hidden={preview !== null}
        className={`block w-full resize-y rounded-b-md bg-transparent px-2.5 py-1.5 text-sm outline-none ${mono ? "font-mono text-xs" : ""}`}
      />
      {preview !== null && (
        <div className="min-h-16 px-2.5 py-2 text-sm leading-relaxed text-slate-800" style={{ minHeight: `${rows * 1.5}rem` }}>
          {preview.trim() ? (
            variant === "line" ? (
              <ul className="list-disc space-y-1 pl-5">
                {preview
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((l, i) => (
                    <li key={i}>
                      <RichText text={l} inline />
                    </li>
                  ))}
              </ul>
            ) : (
              <RichText text={preview} />
            )
          ) : (
            <span className="text-slate-400">Chưa có nội dung</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MarkdownHint() {
  return (
    <span className="text-[11px] font-normal tracking-normal text-slate-400 normal-case">
      Markdown: **đậm** *nghiêng* `code` [link](url)
    </span>
  );
}
