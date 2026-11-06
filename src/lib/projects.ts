import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { projects, type Project } from "@/db/schema";

// Dự án đang xem trên giao diện – lưu mã dự án trong cookie, không có thì lấy dự án đầu tiên
export const PROJECT_COOKIE = "tm_project";

export const PROJECT_CODE = /^[A-Z][A-Z0-9]{1,9}$/;

export function listProjects() {
  return db.select().from(projects).orderBy(asc(projects.id));
}

export async function getProjectByCode(code: string): Promise<Project | null> {
  const [p] = await db.select().from(projects).where(eq(projects.code, code.toUpperCase()));
  return p ?? null;
}

export async function getProjectById(id: number): Promise<Project | null> {
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}

// Dự án mặc định (dự án tạo sớm nhất) – dùng khi API không gửi du_an
export async function getDefaultProject(): Promise<Project> {
  const [p] = await db.select().from(projects).orderBy(asc(projects.id)).limit(1);
  if (!p) throw new Error("Chưa có dự án nào");
  return p;
}

export const getCurrentProject = cache(async (): Promise<Project> => {
  const code = (await cookies()).get(PROJECT_COOKIE)?.value;
  return (code && (await getProjectByCode(code))) || getDefaultProject();
});

// Số việc / đợt của từng dự án cho trang quản trị
export async function projectStats() {
  const rows = await db.execute<{ project_id: number; tasks: number; open: number; sprints: number }>(sql`
    select p.id as project_id,
      (select count(*)::int from tasks t where t.project_id = p.id) as tasks,
      (select count(*)::int from tasks t where t.project_id = p.id and t.status not in ('xong', 'released', 'huy')) as open,
      (select count(*)::int from sprints s where s.project_id = p.id) as sprints
    from projects p`);
  return new Map(rows.rows.map((r) => [r.project_id, r]));
}
