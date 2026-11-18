import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { meta, taskLogs, tasks, users } from "@/db/schema";
import { today } from "./constants";
import { generate } from "./gemini";
import { RC_VERSION, saveDevRelease } from "./releases";
import { buildSummary, getReport, summaryText } from "./report";
import { getWeekly, upsertWeekly, weeklyApi } from "./weekly";

// Viết lời cho các trang báo cáo bằng Gemini – mỗi hàm chỉ chạy khi admin bấm nút trên trang đó.
// Số liệu lấy từ hệ thống; Gemini chỉ viết lời, không được bịa số.

const COMMON =
  "Bạn là trợ lý quản lý dự án phần mềm của Siroby. Viết tiếng Việt, ngắn, rõ, giọng báo cáo cho quản lý. " +
  "Chỉ dùng số và mã việc có trong dữ liệu, không bịa. Thiếu dữ liệu thì nói thẳng. Định dạng Markdown, không mở đầu / kết thúc xã giao.";

const WEEKLY_RULES = `${COMMON}
Viết báo cáo tuần đọc trong 2 phút, đúng các mục:
## Mục tiêu – mỗi mục tiêu một dòng: % so với nhip_deu_can, đánh giá (danh_gia_chu), một câu vì sao (đang vướng gì).
## Đạt được – gom theo mục tiêu, nêu kết quả chứ không chép tiêu đề từng việc; tối đa khoảng 6 dòng.
## Đang làm – chỉ việc đáng chú ý: đứng yên ≥ 5 ngày, chờ duyệt / kiểm tra lâu, bị chặn.
## Kế hoạch tuần tới – theo từng người, lấy từ ke_hoach_tuan_toi (kế hoạch vừa sức, không thêm việc vượt sức). Ghi rõ việc cần người nhận, không vừa sức, bị chặn.
Nếu có mục tiêu danh_gia là khong-kip hoặc qua-han: thêm ## Cần quyết, nêu lựa chọn (lùi hạn / thu hẹp phạm vi / thêm người), không tự quyết.
Có thể dùng ban_nhap làm khung.`;

export async function aiWeekly(project: { id: number; code: string }, week: string, userId: number) {
  const w = await getWeekly(project.id, week);
  const data = { ...weeklyApi(w, project.code), bao_cao: undefined }; // không đưa bản cũ để khỏi chép lại
  const { text, tokens } = await generate({
    system: WEEKLY_RULES,
    prompt: `Số liệu tuần ${w.weekStart} → ${w.weekEnd} (JSON):\n${JSON.stringify(data)}`,
  });
  await upsertWeekly(project.id, w.weekStart, text, userId);
  return tokens;
}

const RELEASE_RULES = `${COMMON}
Viết trang release lên môi trường Dev, gồm hai phần trả về dạng JSON:
- noi_dung (Nhận xét chung): người đọc là quản lý, không phải dev. 5–10 dòng: đợt này mang lại gì cho business / người dùng, 3–5 tính năng hoặc thay đổi nổi bật nói bằng lời người dùng, rủi ro hoặc điều cần quyết nếu có. Không liệt kê từng việc, không chi tiết kỹ thuật.
- ghi_chu (Ghi chú thêm): chi tiết kỹ thuật, việc phải làm khi triển khai (secret, migration…) nếu dữ liệu có nhắc, cách thử, cách quay lại. Có thể dùng mã việc. Không có gì thì ghi "Không có ghi chú kỹ thuật đặc biệt."`;

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export async function aiRelease(project: { id: number; code: string }, version: string, userId: number) {
  const m = RC_VERSION.exec(version);
  if (!m) throw new Error(`Phiên bản ${version} không đúng dạng x.y.z-rcN`);
  const rows = await db
    .select({ key: tasks.key, title: tasks.title, area: tasks.area, type: tasks.type, description: tasks.description, assignee: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.projectId, project.id), eq(tasks.releasedVersion, version)))
    .orderBy(asc(tasks.seq), asc(tasks.key));
  if (!rows.length) throw new Error(`Chưa có việc nào gắn bản ${version}`);
  const logs = await db
    .select({ key: taskLogs.taskKey, text: taskLogs.text })
    .from(taskLogs)
    .where(inArray(taskLogs.taskKey, rows.map((r) => r.key)))
    .orderBy(desc(taskLogs.id));
  const viec = rows.map((r) => ({
    id: r.key,
    tieu_de: r.title,
    mang: r.area,
    loai: r.type,
    nguoi_lam: r.assignee,
    mo_ta: cut(r.description, 800),
    nhat_ky_gan_nhat: logs.filter((l) => l.key === r.key).slice(0, 4).map((l) => cut(l.text, 200)),
  }));
  const { text, tokens } = await generate({
    system: RELEASE_RULES,
    prompt: `Bản ${version}, dự án ${project.code}, ${viec.length} việc (JSON):\n${JSON.stringify(viec)}`,
    json: {
      type: "OBJECT",
      properties: { noi_dung: { type: "STRING" }, ghi_chu: { type: "STRING" } },
      required: ["noi_dung", "ghi_chu"],
    },
  });
  let out: { noi_dung?: string; ghi_chu?: string };
  try {
    out = JSON.parse(text);
  } catch {
    throw new Error("Gemini trả về sai định dạng – thử lại");
  }
  if (!out.noi_dung?.trim()) throw new Error("Gemini không viết được nhận xét – thử lại");
  await saveDevRelease(project.id, m[1], Number(m[2]), { body: out.noi_dung.trim(), notes: (out.ghi_chu ?? "").trim() }, userId);
  return tokens;
}

// Nhận định ở đầu trang Tổng quan – lưu trong meta của dự án, không đè số liệu tính sẵn
export const INSIGHT_KEY = "ai_nhan_dinh";
export type Insight = { text: string; at: string; by: string; model?: string };

const OVERVIEW_RULES = `${COMMON}
Từ bản tóm tắt số liệu dự án, viết phần "Nhận định" 6–10 gạch đầu dòng cho quản lý: điểm nóng cần chú ý ngay, rủi ro tiến độ, người quá tải / nhẹ việc nếu có, và 2–3 đề xuất hành động cụ thể (ai làm gì). Không lặp lại toàn bộ số liệu, không thêm tiêu đề.`;

export async function aiOverview(project: { id: number; name: string }, by: string) {
  const r = await getReport(project.id);
  const date = today().split("-").reverse().join("/");
  const { text, tokens } = await generate({
    system: OVERVIEW_RULES,
    prompt: summaryText(buildSummary(r, project.name), project.name, date),
  });
  const value: Insight = { text, at: new Date().toISOString(), by };
  await db
    .insert(meta)
    .values({ projectId: project.id, key: INSIGHT_KEY, value })
    .onConflictDoUpdate({ target: [meta.projectId, meta.key], set: { value } });
  return tokens;
}
