import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, json, parseBody, patchTaskSchema, readJson, toTaskData, withApiAuth } from "@/lib/api";
import { getApiTask } from "@/lib/api-tasks";
import { resolveTaskKey, updateTaskCore } from "@/lib/task-service";

type Ctx = RouteContext<"/api/v1/tasks/[id]">;

export const GET = withApiAuth(async (_req, _me, { params }: Ctx) => {
  const { id } = await params;
  const key = await resolveTaskKey(id);
  if (!key) throw new ApiError(404, `Không có việc '${id}'`);
  return json(await getApiTask(key));
});

// Sửa một phần: chỉ gửi trường cần đổi. Đổi trang_thai / nguoi_lam tự ghi nhật ký.
export const PATCH = withApiAuth(async (req, me, { params }: Ctx) => {
  const id = (await params).id;
  const key = await resolveTaskKey(id);
  if (!key) throw new ApiError(404, `Không có việc '${id}'`);
  const input = parseBody(patchTaskSchema, await readJson(req));
  const [current] = await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.key, key));
  if (!current) throw new ApiError(404, `Không có việc '${key}'`);
  const patch = await toTaskData(input, current.projectId);

  if (input.khoa_ngoai) {
    const [clash] = await db
      .select({ key: tasks.key })
      .from(tasks)
      .where(and(eq(tasks.externalKey, input.khoa_ngoai), ne(tasks.key, key)));
    if (clash) throw new ApiError(409, `khoa_ngoai đã thuộc về việc ${clash.key}`);
  }
  if (!(await updateTaskCore(key, patch, me))) throw new ApiError(404, `Không có việc '${key}'`);
  return json(await getApiTask(key));
});
