import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, sprints } from "@/db/schema";
import { json, resolveProject, withApiAuth } from "@/lib/api";

// ?du_an=SIA – không có thì trả đợt của mọi dự án
export const GET = withApiAuth(async (req) => {
  const code = new URL(req.url).searchParams.get("du_an");
  const project = code ? await resolveProject(code) : null;
  const rows = await db
    .select({ du_an: projects.code, ma: sprints.code, mo_ta: sprints.description })
    .from(sprints)
    .innerJoin(projects, eq(projects.id, sprints.projectId))
    .where(project ? eq(sprints.projectId, project.id) : undefined)
    .orderBy(asc(projects.id), asc(sprints.position), asc(sprints.code));
  return json({ dot: rows });
});
