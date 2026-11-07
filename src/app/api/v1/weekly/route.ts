import { ApiError, json, readJson, resolveProject, withApiAuth } from "@/lib/api";
import { today } from "@/lib/constants";
import { getWeekly, upsertWeekly, weeklyApi } from "@/lib/weekly";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function week(v: unknown) {
  if (v == null || v === "") return today();
  if (typeof v !== "string" || !DAY.test(v)) throw new ApiError(400, "tuan phải là ngày YYYY-MM-DD (ngày bất kỳ trong tuần)");
  return v;
}

// Số liệu báo cáo tuần so với mục tiêu + bản nháp + bản đã viết (nếu có). ?du_an=SIA&tuan=2026-11-07
export const GET = withApiAuth(async (req) => {
  const sp = new URL(req.url).searchParams;
  const project = await resolveProject(sp.get("du_an"));
  return json(weeklyApi(await getWeekly(project.id, week(sp.get("tuan"))), project.code));
});

// Ghi (hoặc ghi đè) báo cáo tuần: { du_an?, tuan?, noi_dung: "Markdown" }
export const PUT = withApiAuth(async (req, me) => {
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Body phải là object JSON");
  const { du_an, tuan, noi_dung, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length) throw new ApiError(400, `Trường không biết: ${Object.keys(rest).join(", ")}`);
  if (typeof noi_dung !== "string" || !noi_dung.trim()) throw new ApiError(400, "Cần noi_dung (Markdown)");
  const project = await resolveProject(typeof du_an === "string" ? du_an : null);
  const ws = await upsertWeekly(project.id, week(tuan), noi_dung.trim(), me.id);
  return json({ du_an: project.code, tuan: ws, da_luu: true });
});
