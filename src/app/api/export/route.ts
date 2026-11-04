import { getCurrentUser } from "@/lib/auth";
import { exportBacklog } from "@/lib/backlog";
import { today } from "@/lib/constants";
import { getCurrentProject, getProjectByCode } from "@/lib/projects";

// ?du_an=SIA – không có thì lấy dự án đang xem
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return new Response("Chưa đăng nhập", { status: 401 });
  const code = new URL(req.url).searchParams.get("du_an");
  const project = code ? await getProjectByCode(code) : await getCurrentProject();
  if (!project) return new Response(`Không có dự án '${code}'`, { status: 404 });
  const data = await exportBacklog(project);
  return new Response(JSON.stringify(data, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backlog-${project.code}-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
