import { z } from "zod";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { ApiError, json, parseBody, readJson, withApiAuth } from "@/lib/api";
import { getApiTask } from "@/lib/api-tasks";
import { resolveTaskKey } from "@/lib/task-service";

export const POST = withApiAuth(async (req, me, { params }: RouteContext<"/api/v1/tasks/[id]/comments">) => {
  const key = await resolveTaskKey((await params).id);
  if (!key) throw new ApiError(404, `Không có việc '${(await params).id}'`);
  const { noi_dung } = parseBody(z.object({ noi_dung: z.string().trim().min(1) }).strict(), await readJson(req));
  await getApiTask(key); // 404 nếu không có việc
  const [c] = await db.insert(comments).values({ taskKey: key, body: noi_dung, userId: me.id }).returning();
  return json({ id: c.id, nguoi: me.email, noi_dung: c.body, luc: c.createdAt }, 201);
});
