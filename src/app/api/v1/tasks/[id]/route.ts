import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, json, parseBody, patchTaskSchema, readJson, toTaskData, withApiAuth } from "@/lib/api";
import { getApiTask } from "@/lib/api-tasks";
import { updateTaskCore } from "@/lib/task-service";

type Ctx = RouteContext<"/api/v1/tasks/[id]">;

export const GET = withApiAuth(async (_req, _me, { params }: Ctx) => {
  const { id } = await params;
  return json(await getApiTask(id.toUpperCase()));
});

// Sửa một phần: chỉ gửi trường cần đổi. Đổi trang_thai / nguoi_lam tự ghi nhật ký.
export const PATCH = withApiAuth(async (req, me, { params }: Ctx) => {
  const key = (await params).id.toUpperCase();
  const input = parseBody(patchTaskSchema, await readJson(req));
  const patch = await toTaskData(input);

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
