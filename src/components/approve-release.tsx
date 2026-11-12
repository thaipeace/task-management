"use client";

import { useTransition } from "react";
import { approveRelease } from "@/app/actions/releases";
import { toast } from "@/lib/toast";

export function ApproveRelease({ project, version, pending }: { project: string; version: string; pending: number }) {
  const [busy, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        const msg = `Duyệt ${version}: đã release xong?\n${pending} việc đang Xong trên Dev sẽ chuyển sang Released.`;
        if (!confirm(msg)) return;
        startTransition(async () => {
          await toast.run(() => approveRelease(project, version), {
            loading: `Đang duyệt ${version}…`,
            success: `Đã duyệt ${version} – ${pending} việc chuyển sang Released`,
            error: `Không duyệt được ${version}`,
          });
        });
      }}
      className="btn-primary shrink-0 px-2.5 py-1 text-xs"
    >
      {busy ? "Đang duyệt…" : "Duyệt"}
    </button>
  );
}
