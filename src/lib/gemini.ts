import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

// Gemini chỉ chạy khi admin bấm nút trên từng trang báo cáo – không có lịch tự chạy, nên token dùng bao nhiêu
// là do người bấm. Thêm hạn mức token / tháng để chặn khi lỡ tay.

export const DEFAULT_MODEL = "gemini-flash-latest";
export const MODEL_SUGGESTIONS = ["gemini-flash-latest", "gemini-pro-latest", "gemini-2.5-flash", "gemini-2.5-pro"];

export type GeminiConfig = { apiKey: string; model: string; monthlyLimit: number };
export type GeminiUsage = { month: string; tokens: number; calls: number };

export class AiError extends Error {}

const month = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7);

async function read(key: string) {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row ?? null;
}

export async function getGeminiConfig(): Promise<GeminiConfig | null> {
  const v = (await read("gemini"))?.value;
  if (!v?.apiKey) return null;
  return { apiKey: String(v.apiKey), model: String(v.model || DEFAULT_MODEL), monthlyLimit: Number(v.monthlyLimit) || 0 };
}

// có khoá thì mới hiện nút Gemini trên các trang báo cáo
export async function aiReady() {
  return !!(await getGeminiConfig());
}

// phần được phép hiện ra trình duyệt: không có khoá, chỉ 4 ký tự cuối
export async function getGeminiStatus() {
  const [cfg, usage, row] = await Promise.all([getGeminiConfig(), getUsage(), read("gemini")]);
  return {
    configured: !!cfg,
    keyTail: cfg ? cfg.apiKey.slice(-4) : null,
    model: cfg?.model ?? DEFAULT_MODEL,
    monthlyLimit: cfg?.monthlyLimit ?? 0,
    usage,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function saveGeminiConfig(patch: { apiKey?: string; model: string; monthlyLimit: number }, userId: number) {
  const old = await getGeminiConfig();
  const apiKey = patch.apiKey ?? old?.apiKey ?? "";
  const value = { apiKey, model: patch.model || DEFAULT_MODEL, monthlyLimit: patch.monthlyLimit };
  await db
    .insert(appSettings)
    .values({ key: "gemini", value, updatedById: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedById: userId, updatedAt: new Date() } });
}

export async function clearGeminiConfig() {
  await db.delete(appSettings).where(eq(appSettings.key, "gemini"));
}

export async function getUsage(): Promise<GeminiUsage> {
  const v = (await read("gemini_usage"))?.value as GeminiUsage | undefined;
  const m = month();
  return v?.month === m ? v : { month: m, tokens: 0, calls: 0 };
}

async function addUsage(tokens: number) {
  const m = month();
  // cộng dồn trong tháng; sang tháng mới thì đếm lại từ đầu
  await db
    .insert(appSettings)
    .values({ key: "gemini_usage", value: { month: m, tokens, calls: 1 } })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        updatedAt: new Date(),
        value: sql`case when ${appSettings.value}->>'month' = ${m}
          then jsonb_build_object('month', ${m}::text,
            'tokens', coalesce((${appSettings.value}->>'tokens')::int, 0) + ${tokens}::int,
            'calls', coalesce((${appSettings.value}->>'calls')::int, 0) + 1)
          else jsonb_build_object('month', ${m}::text, 'tokens', ${tokens}::int, 'calls', 1) end`,
      },
    });
}

type GenOpts = { system: string; prompt: string; json?: Record<string, unknown> };

// Gọi Gemini một lần, trả về chữ (hoặc JSON nếu có schema) và số token đã dùng
export async function generate({ system, prompt, json }: GenOpts, cfg?: GeminiConfig | null) {
  cfg ??= await getGeminiConfig();
  if (!cfg) throw new AiError("Chưa cài khoá API Gemini – vào Quản trị → Cài đặt AI");
  if (cfg.monthlyLimit) {
    const u = await getUsage();
    if (u.tokens >= cfg.monthlyLimit) {
      throw new AiError(`Đã dùng hết hạn mức ${cfg.monthlyLimit.toLocaleString("vi-VN")} token tháng này – tăng hạn mức ở Cài đặt AI`);
    }
  }
  let res: Response;
  try {
    res = await fetch(`${process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, ...(json ? { responseMimeType: "application/json", responseSchema: json } : {}) },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new AiError("Không gọi được Gemini (mạng hoặc quá thời gian) – thử lại sau");
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    usageMetadata?: { totalTokenCount?: number };
  };
  const tokens = data.usageMetadata?.totalTokenCount ?? 0;
  if (tokens) await addUsage(tokens);
  if (!res.ok) throw new AiError(`Gemini báo lỗi: ${data.error?.message ?? res.status}`);
  const c = data.candidates?.[0];
  const text = (c?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new AiError(`Gemini không trả lời (${c?.finishReason ?? "rỗng"}) – thử lại`);
  return { text, tokens };
}
