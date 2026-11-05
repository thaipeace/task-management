"use client";

import { useState } from "react";

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
