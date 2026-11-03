import { getCurrentUser } from "@/lib/auth";
import { exportBacklog } from "@/lib/backlog";
import { today } from "@/lib/constants";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return new Response("Chưa đăng nhập", { status: 401 });
  const data = await exportBacklog();
  return new Response(JSON.stringify(data, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backlog-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
