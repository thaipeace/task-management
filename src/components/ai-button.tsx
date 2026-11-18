"use client";

import { useTransition } from "react";
import { type AiResult, aiWriteOverview, aiWriteRelease, aiWriteWeekly } from "@/app/actions/ai";
import { toast } from "@/lib/toast";

type Props =
  | { kind: "weekly"; project: string; week: string; overwrite: boolean }
  | { kind: "release"; project: string; version: string; overwrite: boolean }
  | { kind: "overview"; project: string; overwrite: boolean };

const LABEL = { weekly: "báo cáo tuần", release: "nhận xét và ghi chú của bản này", overview: "nhận định" };

// Chỉ chạy khi bấm – mỗi lần bấm là một lần gọi Gemini (tốn token), nên luôn hỏi lại trước
export function AiButton(props: Props) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      className="btn-secondary"
      title="Gọi Gemini một lần để viết lại phần lời của trang này"
      onClick={() => {
        const msg = `Gọi Gemini viết ${LABEL[props.kind]}?${props.overwrite ? "\nBản hiện có sẽ bị ghi đè." : ""}`;
        if (!confirm(msg)) return;
        start(async () => {
          const id = toast.loading("Gemini đang viết…", { delay: 0 });
          let r: AiResult;
          try {
            r =
              props.kind === "weekly"
                ? await aiWriteWeekly(props.project, props.week)
                : props.kind === "release"
                  ? await aiWriteRelease(props.project, props.version)
                  : await aiWriteOverview(props.project);
          } catch {
            r = { error: "Không kết nối được máy chủ – thử lại" };
          }
          if (r.error) toast.error(r.error, { id });
          else toast.success(r.ok ?? "Đã xong", { id });
        });
      }}
    >
      {busy ? "Gemini đang viết…" : "✦ Viết bằng Gemini"}
    </button>
  );
}
