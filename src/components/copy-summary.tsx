"use client";

import { useState } from "react";

// Sao chép đường dẫn trang đang xem
export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn-secondary"
    >
      {copied ? "Đã sao chép ✓" : "Sao chép đường dẫn"}
    </button>
  );
}

export function CopySummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn-secondary"
    >
      {copied ? "Đã sao chép ✓" : "Sao chép tóm tắt"}
    </button>
  );
}
