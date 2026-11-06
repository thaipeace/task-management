import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { projects, records } from "@/db/schema";
import { ApiError, json, readJson, resolveProject, withApiAuth } from "@/lib/api";
import { LOAI, createRecord, decisionFields, riskFields } from "@/lib/api-records";

// AR (chấp nhận rủi ro) và QD (chờ quyết định) – cùng dạng với backlog.json.
// ?du_an=SIA (không có thì mọi dự án), ?loai=rui_ro | quyet_dinh
export const GET = withApiAuth(async (req) => {
  const sp = new URL(req.url).searchParams;
  const code = sp.get("du_an");
  const loai = sp.get("loai");
  if (loai && !(loai in LOAI)) throw new ApiError(400, `loai phải là rui_ro hoặc quyet_dinh, không phải '${loai}'`);
  const project = code ? await resolveProject(code) : null;
  const where: SQL[] = [];
  if (project) where.push(eq(records.projectId, project.id));
  if (loai) where.push(eq(records.kind, LOAI[loai]));
  const rows = await db
    .select({ key: records.key, kind: records.kind, data: records.data, du_an: projects.code })
    .from(records)
    .innerJoin(projects, eq(projects.id, records.projectId))
    .where(and(...where))
    .orderBy(asc(projects.id), asc(records.position), asc(records.key));
  const out = (kind: "risk" | "decision") =>
    rows.filter((r) => r.kind === kind).map((r) => ({ id: r.key, du_an: r.du_an, ...r.data }));
  return json({
    ...(loai !== "quyet_dinh" ? { chap_nhan_rui_ro: out("risk") } : {}),
    ...(loai !== "rui_ro" ? { cho_quyet_dinh: out("decision") } : {}),
  });
});

// Tạo AR / QD: { du_an?, loai: "quyet_dinh" | "rui_ro", ...trường }. Id tự cấp (QD-005…)
export const POST = withApiAuth(async (req) => {
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Body phải là object JSON");
  const { du_an, loai, ...rest } = body as Record<string, unknown>;
  const kind = typeof loai === "string" ? LOAI[loai] : undefined;
  if (!kind) throw new ApiError(400, "Cần loai: quyet_dinh hoặc rui_ro");
  const project = await resolveProject(typeof du_an === "string" ? du_an : null);
  const parsed = (kind === "risk" ? riskFields : decisionFields).safeParse(rest);
  if (!parsed.success) {
    throw new ApiError(400, `Dữ liệu không hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join(".") || i.code}: ${i.message}`).join("; ")}`);
  }
  return json(await createRecord(project, kind, parsed.data as Record<string, unknown>), 201);
});
