import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taskLogs, tasks, users } from "@/db/schema";
import { nextKey } from "./backlog";
import { STATUSES, labelOf, today } from "./constants";

// Logic tạo / sửa việc dùng chung cho giao diện (server action) và API,
// để nhật ký được ghi giống nhau bất kể đổi từ đâu.

export type Actor = { id: number; name: string };

export type TaskData = Omit<
  typeof tasks.$inferInsert,
  "key" | "seq" | "position" | "createdOn" | "updatedOn" | "extra" | "updatedAt"
>;

async function userName(id: number | null | undefined) {
  if (!id) return "chưa giao";
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return u?.name ?? "?";
}

export function statusLog(from: string, to: string, actor: Actor) {
  return `Trạng thái: ${labelOf(STATUSES, from)} → ${labelOf(STATUSES, to)} (${actor.name})`;
}

export async function createTaskCore(data: TaskData, actor: Actor, via = "") {
  const date = today();
  return db.transaction(async (tx) => {
    const key = await nextKey(tx, data.area);
    await tx.insert(tasks).values({
      ...data,
      key,
      position: Date.now(),
      createdOn: date,
      updatedOn: date,
    });
    await tx
      .insert(taskLogs)
      .values({ taskKey: key, date, text: `Tạo việc${via} (${actor.name})`, userId: actor.id });
    return key;
  });
}

// Trả về false khi không có việc này
export async function updateTaskCore(key: string, patch: Partial<TaskData>, actor: Actor) {
  const [old] = await db.select().from(tasks).where(eq(tasks.key, key));
  if (!old) return false;
  const date = today();

  const logs: string[] = [];
  if (patch.status !== undefined && patch.status !== old.status) {
    logs.push(statusLog(old.status, patch.status, actor));
  }
  if (patch.assigneeId !== undefined && patch.assigneeId !== old.assigneeId) {
    logs.push(`Giao cho: ${await userName(patch.assigneeId)} (${actor.name})`);
  }

  // mảng (BE/FE…) chỉ là nhãn – id giữ nguyên để không gãy liên kết
  await db
    .update(tasks)
    .set({ ...patch, updatedOn: date, updatedAt: new Date() })
    .where(eq(tasks.key, key));
  if (logs.length) {
    await db
      .insert(taskLogs)
      .values(logs.map((text) => ({ taskKey: key, date, text, userId: actor.id })));
  }
  return true;
}
