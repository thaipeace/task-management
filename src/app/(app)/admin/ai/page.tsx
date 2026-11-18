import type { Metadata } from "next";
import { Suspense } from "react";
import { AiSettingsForm } from "@/components/ai-settings";
import { Loading, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { MODEL_SUGGESTIONS, getGeminiStatus } from "@/lib/gemini";

export const metadata: Metadata = { title: "Cài đặt AI" };

export default function AiSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cài đặt AI"
        subtitle="Khoá API Gemini để viết lời cho các trang báo cáo. Chỉ chạy khi admin bấm nút ✦ Viết bằng Gemini trên từng trang – không có gì tự chạy."
      />
      <Suspense fallback={<Loading />}>
        <AiSettingsContent />
      </Suspense>
    </div>
  );
}

async function AiSettingsContent() {
  await requireAdmin();
  const s = await getGeminiStatus();
  return (
    <AiSettingsForm
      status={{
        configured: s.configured,
        keyTail: s.keyTail,
        model: s.model,
        monthlyLimit: s.monthlyLimit,
        usage: s.usage,
      }}
      models={MODEL_SUGGESTIONS}
    />
  );
}
