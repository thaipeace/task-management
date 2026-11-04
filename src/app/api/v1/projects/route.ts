import { json, withApiAuth } from "@/lib/api";
import { listProjects } from "@/lib/projects";

export const GET = withApiAuth(async () => {
  const rows = await listProjects();
  return json({
    du_an: rows.map((p, i) => ({
      ma: p.code,
      ten: p.name,
      mo_ta: p.description,
      // id việc: <ma>-<số>, vd. SIA-039 (id đổi từ chuẩn cũ mà trùng số có thêm a, b…: SIA-010a)
      mau_id_viec: `${p.code}-001`,
      mac_dinh: i === 0,
    })),
  });
});
