import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { ApiError, json, parseBody, readJson, withApiAuth } from "@/lib/api";
import { resolveTaskKey } from "@/lib/task-service";

// Sửa bình luận – như trên giao diện: chỉ người viết (chủ token) sửa được bình luận của mình
export const PATCH = withApiAuth(
  async (req, me, { params }: RouteContext<"/api/v1/tasks/[id]/comments/[cid]">) => {
    const { id, cid } = await params;
    const key = await resolveTaskKey(id);
    if (!key) throw new ApiError(404, `Không có việc '${id}'`);
    const commentId = Number(cid);
    if (!Number.isInteger(commentId) || commentId <= 0) throw new ApiError(400, `Id bình luận không hợp lệ: '${cid}'`);
    const { noi_dung } = parseBody(z.object({ noi_dung: z.string().trim().min(1) }).strict(), await readJson(req));

    const [c] = await db
      .select({ userId: comments.userId })
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.taskKey, key)));
    if (!c) throw new ApiError(404, `Việc ${key} không có bình luận ${commentId}`);
    if (c.userId !== me.id) throw new ApiError(403, "Chỉ sửa được bình luận do chính tài khoản của token viết");

    const [row] = await db
      .update(comments)
      .set({ body: noi_dung, editedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();
    return json({ id: row.id, nguoi: me.email, noi_dung: row.body, luc: row.createdAt, sua_luc: row.editedAt });
  },
);
