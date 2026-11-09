import { ApiError, json, readJson, resolveProject, withApiAuth } from "@/lib/api";
import { MAIN_VERSION, listDevReleases, releaseApi, releaseVersion, saveDevRelease } from "@/lib/releases";

function mainVersion(v: unknown) {
  const s = typeof v === "string" ? v.trim().replace(/^v/i, "") : "";
  if (!MAIN_VERSION.test(s)) throw new ApiError(400, "main phải là version của main dạng 2.45.0");
  return s;
}

function rcNumber(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, "rc phải là số nguyên ≥ 1");
  return n;
}

// Các đợt Dev release, mới nhất trước. ?du_an=SIA&main=2.45.0 (chỉ lấy các rc của version đó)
export const GET = withApiAuth(async (req) => {
  const sp = new URL(req.url).searchParams;
  const project = await resolveProject(sp.get("du_an"));
  const main = sp.get("main") ? mainVersion(sp.get("main")) : null;
  const rows = await listDevReleases(project.id);
  return json({ releases: rows.filter((r) => !main || r.mainVersion === main).map((r) => releaseApi(r, project.code)) });
});

// Ghi đợt release: { du_an?, main: "2.45.0", rc?: 2, noi_dung: "Markdown" }. Không gửi rc thì tự lấy số kế tiếp.
export const PUT = withApiAuth(async (req, me) => {
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Body phải là object JSON");
  const { du_an, main, rc, noi_dung, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length) throw new ApiError(400, `Trường không biết: ${Object.keys(rest).join(", ")}`);
  if (typeof noi_dung !== "string" || !noi_dung.trim()) throw new ApiError(400, "Cần noi_dung (Markdown)");
  const project = await resolveProject(typeof du_an === "string" ? du_an : null);
  const version = mainVersion(main);
  const saved = await saveDevRelease(project.id, version, rcNumber(rc), noi_dung.trim(), me.id);
  return json({ du_an: project.code, phien_ban: releaseVersion(version, saved.rc), main: version, rc: saved.rc, tao_moi: saved.created, da_luu: true });
});
