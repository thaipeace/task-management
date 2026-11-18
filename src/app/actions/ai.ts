"use server";

import { refresh } from "next/cache";
import { aiOverview, aiRelease, aiWeekly } from "@/lib/ai-reports";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_MODEL, clearGeminiConfig, generate, saveGeminiConfig } from "@/lib/gemini";
import { getProjectByCode } from "@/lib/projects";

export type AiResult = { ok?: string; error?: string };

// Lỗi trả về dạng chữ (bản production giấu nội dung lỗi ném ra từ server action)
async function guard(work: () => Promise<string>): Promise<AiResult> {
  try {
    const ok = await work();
    refresh();
    return { ok };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không thực hiện được" };
  }
}

const tok = (n: number) => `${n.toLocaleString("vi-VN")} token`;

async function project(code: string) {
  const p = await getProjectByCode(code);
  if (!p) throw new Error("Không có dự án này");
  return p;
}

export async function saveAiSettings(form: FormData): Promise<AiResult> {
  const me = await requireAdmin();
  return guard(async () => {
    const key = String(form.get("apiKey") ?? "").trim();
    const model = String(form.get("model") ?? "").trim() || DEFAULT_MODEL;
    if (!/^[\w.-]+$/.test(model)) throw new Error("Tên model không hợp lệ");
    const limit = Math.max(0, Math.round(Number(String(form.get("monthlyLimit") ?? "0").replace(/\D/g, "")) || 0));
    await saveGeminiConfig({ apiKey: key || undefined, model, monthlyLimit: limit }, me.id);
    return "Đã lưu cài đặt";
  });
}

export async function removeAiKey(): Promise<AiResult> {
  await requireAdmin();
  return guard(async () => {
    await clearGeminiConfig();
    return "Đã xoá khoá API";
  });
}

export async function testAi(): Promise<AiResult> {
  await requireAdmin();
  return guard(async () => {
    const { text, tokens } = await generate({ system: "Trả lời đúng một từ.", prompt: "Nói: OK" });
    return `Gemini trả lời "${text.slice(0, 40)}" (${tok(tokens)})`;
  });
}

export async function aiWriteWeekly(code: string, week: string): Promise<AiResult> {
  const me = await requireAdmin();
  return guard(async () => `Gemini đã viết báo cáo tuần (${tok(await aiWeekly(await project(code), week, me.id))})`);
}

export async function aiWriteRelease(code: string, version: string): Promise<AiResult> {
  const me = await requireAdmin();
  return guard(async () => `Gemini đã viết ${version} (${tok(await aiRelease(await project(code), version, me.id))})`);
}

export async function aiWriteOverview(code: string): Promise<AiResult> {
  const me = await requireAdmin();
  return guard(async () => `Gemini đã viết nhận định (${tok(await aiOverview(await project(code), me.name))})`);
}
