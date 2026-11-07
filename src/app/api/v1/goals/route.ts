import { json, resolveProject, withApiAuth } from "@/lib/api";
import { today } from "@/lib/constants";
import { getWeekly, goalApi } from "@/lib/weekly";

// Mục tiêu của dự án kèm tiến độ tính đến hôm nay. Mục tiêu do người đặt trên web (trang Mục tiêu).
export const GET = withApiAuth(async (req) => {
  const project = await resolveProject(new URL(req.url).searchParams.get("du_an"));
  const w = await getWeekly(project.id, today());
  return json({ du_an: project.code, muc_tieu: w.goals.map(goalApi) });
});
