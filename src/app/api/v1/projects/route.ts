import { json, withApiAuth } from "@/lib/api";
import { listProjects } from "@/lib/projects";

export const GET = withApiAuth(async () => {
  const rows = await listProjects();
  return json({
    du_an: rows.map((p, i) => ({
      ma: p.code,
      ten: p.name,
      mo_ta: p.description,
      // id việc mới = tien_to_id + mảng + số, vd. "" + "BE-014" hoặc "ABC-" + "BE-001"
      tien_to_id: p.keyPrefix,
      mac_dinh: i === 0,
    })),
  });
});
