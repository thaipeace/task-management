import { z } from "zod";
import { db } from "@/db";
import { taskLogs } from "@/db/schema";
import { ApiError, json, parseBody, readJson, withApiAuth } from "@/lib/api";
import { getApiTask } from "@/lib/api-tasks";
import { resolveTaskKey } from "@/lib/task-service";
import { today } from "@/lib/constants";

// Thêm một dòng nhat_ky (vd. "Chạy lại kiem-thu/may-chu.mjs: vẫn lỗi")
export const POST = withApiAuth(async (req, me, { params }: RouteContext<"/api/v1/tasks/[id]/logs">) => {
  const key = await resolveTaskKey((await params).id);
  if (!key) throw new ApiError(404, `Không có việc '${(await params).id}'`);
  const { ghi } = parseBody(z.object({ ghi: z.string().trim().min(1) }).strict(), await readJson(req));
  await getApiTask(key);
  const entry = { ngay: today(), ghi: `${ghi} (${me.name})` };
  await db.insert(taskLogs).values({ taskKey: key, date: entry.ngay, text: entry.ghi, userId: me.id });
  return json(entry, 201);
});
