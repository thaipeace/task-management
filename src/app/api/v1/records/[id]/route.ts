import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, records } from "@/db/schema";
import { ApiError, json, readJson, withApiAuth } from "@/lib/api";
import { loaiOf, updateRecord } from "@/lib/api-records";

// Một bản ghi AR / QD theo id (vd. QD-002)
export const GET = withApiAuth(async (_req, _me, { params }: RouteContext<"/api/v1/records/[id]">) => {
  const id = (await params).id.trim().toUpperCase();
  const [r] = await db
    .select({ key: records.key, kind: records.kind, data: records.data, du_an: projects.code })
    .from(records)
    .innerJoin(projects, eq(projects.id, records.projectId))
    .where(eq(records.key, id));
  if (!r) throw new ApiError(404, `Không có bản ghi '${id}'`);
  return json({ id: r.key, du_an: r.du_an, loai: loaiOf(r.kind), ...r.data });
});

// Sửa một phần: chỉ gửi trường cần đổi, null = xoá trường. Trường lạ từ backlog.json được giữ nguyên.
export const PATCH = withApiAuth(async (req, _me, { params }: RouteContext<"/api/v1/records/[id]">) => {
  return json(await updateRecord((await params).id, await readJson(req)));
});
