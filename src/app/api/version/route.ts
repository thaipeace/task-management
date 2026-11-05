import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";

// Dấu vân tay dữ liệu của dự án đang xem – trình duyệt hỏi định kỳ, khác lần trước thì refresh.
// Gồm cả thứ tự kéo thả (position / sub_order) vì đổi thứ tự không chạm updated_at.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return new Response("Chưa đăng nhập", { status: 401 });
  const project = await getCurrentProject();
  const id = project.id;
  const { rows } = await db.execute<{ v: string }>(sql`
    select md5(concat_ws('|',
      (select concat_ws(':', count(*), max(updated_at), sum(position), sum(sub_order)) from tasks where project_id = ${id}),
      (select concat_ws(':', count(*), max(c.id), max(c.edited_at)) from comments c join tasks t on t.key = c.task_key where t.project_id = ${id}),
      (select concat_ws(':', count(*), max(l.id)) from task_logs l join tasks t on t.key = l.task_key where t.project_id = ${id}),
      (select concat_ws(':', count(*), max(updated_at)) from records where project_id = ${id}),
      (select string_agg(code || ':' || description, ',' order by code) from sprints where project_id = ${id})
    )) as v`);
  return Response.json({ v: `${project.code}:${rows[0].v}` }, { headers: { "Cache-Control": "no-store" } });
}
