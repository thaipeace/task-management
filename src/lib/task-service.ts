import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, taskLogs, tasks, users } from "@/db/schema";
import { nextKey } from "./backlog";
import { STATUSES, labelOf, today } from "./constants";

// Logic tạo / sửa việc dùng chung cho giao diện (server action) và API,
// để nhật ký được ghi giống nhau bất kể đổi từ đâu.

export type Actor = { id: number; name: string };

// Vi phạm quy tắc nghiệp vụ (vd. việc con lồng việc con) – API trả 400, giao diện hiện thông báo
export class TaskRuleError extends Error {}

export type TaskData = Omit<
  typeof tasks.$inferInsert,
  "key" | "seq" | "position" | "subOrder" | "createdOn" | "updatedOn" | "extra" | "updatedAt"
>;

async function userName(id: number | null | undefined) {
  if (!id) return "chưa giao";
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return u?.name ?? "?";
}

export function statusLog(from: string, to: string, actor: Actor) {
  return `Trạng thái: ${labelOf(STATUSES, from)} → ${labelOf(STATUSES, to)} (${actor.name})`;
}

// Việc con chỉ một cấp: cha phải tồn tại, cùng dự án và không là việc con; việc đang có con không được thành việc con
async function checkParent(parentKey: string, projectId: number, selfKey?: string) {
  if (parentKey === selfKey) throw new TaskRuleError("Việc không thể là việc con của chính nó");
  const [parent] = await db
    .select({ parentKey: tasks.parentKey, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.key, parentKey));
  if (!parent) throw new TaskRuleError(`Không có việc cha '${parentKey}'`);
  if (parent.projectId !== projectId) throw new TaskRuleError(`${parentKey} thuộc dự án khác`);
  if (parent.parentKey) {
    throw new TaskRuleError(`${parentKey} đã là việc con của ${parent.parentKey} – việc con không có việc con`);
  }
  if (selfKey) {
    const [{ n }] = await db.select({ n: count() }).from(tasks).where(eq(tasks.parentKey, selfKey));
    if (n > 0) throw new TaskRuleError(`${selfKey} đang có ${n} việc con nên không thể thành việc con`);
  }
}

export async function createTaskCore(data: TaskData, actor: Actor, via = "") {
  const date = today();
  const [project] = await db.select().from(projects).where(eq(projects.id, data.projectId));
  if (!project) throw new TaskRuleError("Không có dự án này");
  if (data.parentKey) await checkParent(data.parentKey, data.projectId);
  return db.transaction(async (tx) => {
    const key = await nextKey(tx, project, data.area);
    let subOrder = 0;
    if (data.parentKey) {
      // việc con mới nằm cuối danh sách
      const [{ max }] = await tx
        .select({ max: sql<number>`coalesce(max(${tasks.subOrder}), 0)` })
        .from(tasks)
        .where(eq(tasks.parentKey, data.parentKey));
      subOrder = Number(max) + 1000;
    }
    await tx.insert(tasks).values({
      ...data,
      key,
      position: Date.now(),
      subOrder,
      createdOn: date,
      updatedOn: date,
    });
    await tx
      .insert(taskLogs)
      .values({ taskKey: key, date, text: `Tạo việc${via} (${actor.name})`, userId: actor.id });
    if (data.parentKey) {
      await tx.insert(taskLogs).values({
        taskKey: data.parentKey,
        date,
        text: `Thêm việc con ${key} (${actor.name})`,
        userId: actor.id,
      });
    }
    return key;
  });
}

export async function reorderSubtask(key: string, subOrder: number) {
  await db.update(tasks).set({ subOrder }).where(and(eq(tasks.key, key), sql`${tasks.parentKey} is not null`));
}

// Trả về false khi không có việc này. Không chuyển việc sang dự án khác (id mang tiền tố dự án).
export async function updateTaskCore(key: string, input: Partial<TaskData>, actor: Actor) {
  const patch = { ...input };
  delete patch.projectId;
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
  if (patch.parentKey !== undefined && patch.parentKey !== old.parentKey) {
    if (patch.parentKey) {
      await checkParent(patch.parentKey, old.projectId, key);
      logs.push(`Thành việc con của ${patch.parentKey} (${actor.name})`);
    } else {
      logs.push(`Tách khỏi việc cha ${old.parentKey} (${actor.name})`);
    }
  }

  // gắn vào việc cha mới thì nằm cuối danh sách việc con, như khi tạo mới
  let subOrder: number | undefined;
  if (patch.parentKey && patch.parentKey !== old.parentKey) {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${tasks.subOrder}), 0)` })
      .from(tasks)
      .where(eq(tasks.parentKey, patch.parentKey));
    subOrder = Number(max) + 1000;
  }

  // mảng (BE/FE…) chỉ là nhãn – id giữ nguyên để không gãy liên kết
  await db
    .update(tasks)
    .set({ ...patch, ...(subOrder !== undefined ? { subOrder } : {}), updatedOn: date, updatedAt: new Date() })
    .where(eq(tasks.key, key));
  if (logs.length) {
    await db
      .insert(taskLogs)
      .values(logs.map((text) => ({ taskKey: key, date, text, userId: actor.id })));
  }
  return true;
}
