"use client";

import { useTransition } from "react";
import { type AiResult, removeAiKey, saveAiSettings, testAi } from "@/app/actions/ai";
import { toast } from "@/lib/toast";

type Status = {
  configured: boolean;
  keyTail: string | null;
  model: string;
  monthlyLimit: number;
  usage: { month: string; tokens: number; calls: number };
};

const n = (x: number) => x.toLocaleString("vi-VN");

export function AiSettingsForm({ status, models }: { status: Status; models: string[] }) {
  const [busy, start] = useTransition();
  const run = (work: () => Promise<AiResult>, loading: string) =>
    start(async () => {
      const id = toast.loading(loading, { delay: 0 });
      let r: AiResult;
      try {
        r = await work();
      } catch {
        r = { error: "Không kết nối được máy chủ – thử lại" };
      }
      if (r.error) toast.error(r.error, { id });
      else toast.success(r.ok ?? "Đã xong", { id });
    });
  const u = status.usage;
  const pct = status.monthlyLimit ? Math.min(100, Math.round((u.tokens / status.monthlyLimit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <form
        className="card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const el = e.currentTarget;
          run(async () => {
            const r = await saveAiSettings(form);
            if (r.ok) (el.elements.namedItem("apiKey") as HTMLInputElement).value = "";
            return r;
          }, "Đang lưu…");
        }}
      >
        <h2 className="font-semibold">Gemini</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Khoá API</span>
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            className="input w-full"
            placeholder={status.configured ? `Đã lưu (…${status.keyTail}) – để trống nếu không đổi` : "AIza…"}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Lấy ở Google AI Studio → Get API key. Khoá lưu trong cơ sở dữ liệu, chỉ máy chủ dùng, không hiện lại trên trình duyệt.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Model</span>
          <input name="model" list="gemini-models" defaultValue={status.model} className="input w-full" />
          <datalist id="gemini-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs text-slate-500">Flash rẻ và đủ cho báo cáo; Pro viết kỹ hơn nhưng tốn hơn.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Hạn mức token / tháng</span>
          <input name="monthlyLimit" inputMode="numeric" defaultValue={status.monthlyLimit || ""} placeholder="0 = không giới hạn" className="input w-48" />
          <span className="mt-1 block text-xs text-slate-500">Dùng hết thì nút Gemini báo lỗi cho tới tháng sau. Một lần viết báo cáo thường vài nghìn – vài chục nghìn token.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            Lưu
          </button>
          {status.configured && (
            <>
              <button type="button" disabled={busy} className="btn-secondary" onClick={() => run(testAi, "Đang thử gọi Gemini…")}>
                Thử kết nối
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-ghost text-red-700"
                onClick={() => confirm("Xoá khoá API Gemini? Các nút Gemini sẽ ngừng hoạt động.") && run(removeAiKey, "Đang xoá…")}
              >
                Xoá khoá
              </button>
            </>
          )}
        </div>
      </form>

      <section className="card p-5">
        <h2 className="font-semibold">Đã dùng tháng {u.month.slice(5)}/{u.month.slice(0, 4)}</h2>
        <p className="mt-2 text-sm text-slate-700">
          <span className="text-2xl font-semibold tabular-nums">{n(u.tokens)}</span> token · {n(u.calls)} lần gọi
          {status.monthlyLimit > 0 && <> · hạn mức {n(status.monthlyLimit)}</>}
        </p>
        {status.monthlyLimit > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100" title={`${pct}% hạn mức`}>
            <div className={`h-full rounded ${pct >= 90 ? "bg-red-600" : "bg-brand"}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </section>
    </div>
  );
}
