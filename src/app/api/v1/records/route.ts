import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { projects, records } from "@/db/schema";
import { ApiError, json, resolveProject, withApiAuth } from "@/lib/api";

const KIND = { rui_ro: "risk", quyet_dinh: "decision" } as const;

// AR (chấp nhận rủi ro) và QD (chờ quyết định) – cùng dạng với backlog.json.
// ?du_an=SIA (không có thì mọi dự án), ?loai=rui_ro | quyet_dinh
export const GET = withApiAuth(async (req) => {
  const sp = new URL(req.url).searchParams;
  const code = sp.get("du_an");
  const loai = sp.get("loai");
  if (loai && !(loai in KIND)) throw new ApiError(400, `loai phải là rui_ro hoặc quyet_dinh, không phải '${loai}'`);
  const project = code ? await resolveProject(code) : null;
  const where: SQL[] = [];
  if (project) where.push(eq(records.projectId, project.id));
  if (loai) where.push(eq(records.kind, KIND[loai as keyof typeof KIND]));
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
