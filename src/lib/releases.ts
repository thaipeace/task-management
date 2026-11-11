import { and, asc, eq, isNotNull, max } from "drizzle-orm";
import { db } from "@/db";
import { devReleases, tasks, users } from "@/db/schema";
import { DONE_STATUSES } from "./constants";
import { TaskRuleError, resolveTaskKey, updateTaskCore, type Actor } from "./task-service";

export const MAIN_VERSION = /^\d+\.\d+\.\d+$/;
const RC_VERSION = /^(\d+\.\d+\.\d+)-rc(\d+)$/;

export type DevRelease = typeof devReleases.$inferSelect;

export function releaseVersion(main: string, rc: number) {
  return `${main}-rc${rc}`;
}

function parts(main: string) {
  return main.split(".").map(Number);
}

// Mới nhất lên đầu: so version theo số (2.10.0 > 2.9.0), cùng main thì rc lớn hơn lên trước
function compare(a: { mainVersion: string; rc: number }, b: { mainVersion: string; rc: number }) {
  const [x, y] = [parts(a.mainVersion), parts(b.mainVersion)];
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || b.rc - a.rc;
}

export async function listDevReleases(projectId: number) {
  const rows = await db.select().from(devReleases).where(eq(devReleases.projectId, projectId));
  return rows.sort(compare);
}

// Một bản theo version trên đường dẫn (2.45.8-rc1). Bản chỉ có việc gắn mà chưa ghi đợt thì release = null.
export async function getDevRelease(projectId: number, version: string) {
  const m = RC_VERSION.exec(version);
  const [release] = m
    ? await db
        .select()
        .from(devReleases)
        .where(and(eq(devReleases.projectId, projectId), eq(devReleases.mainVersion, m[1]), eq(devReleases.rc, Number(m[2]))))
    : [];
  const items = await db
    .select({ key: tasks.key, title: tasks.title, status: tasks.status, area: tasks.area, assignee: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.projectId, projectId), eq(tasks.releasedVersion, version)))
    .orderBy(asc(tasks.seq), asc(tasks.key));
  if (!release && !items.length) return null;
  return { release: release ?? null, tasks: items };
}

// Số việc đã gắn theo từng version
export async function taskCountByVersion(projectId: number) {
  const rows = await db
    .select({ version: tasks.releasedVersion })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.releasedVersion)));
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.version!, (map.get(r.version!) ?? 0) + 1);
  return map;
}

async function nextRc(projectId: number, mainVersion: string) {
  const [row] = await db
    .select({ rc: max(devReleases.rc) })
    .from(devReleases)
    .where(and(eq(devReleases.projectId, projectId), eq(devReleases.mainVersion, mainVersion)));
  return (row?.rc ?? 0) + 1;
}

type Content = { body?: string; notes?: string };

// Không có rc: tạo đợt mới với số kế tiếp (cần body). Có rc: sửa đợt đó – chỉ đổi phần được gửi (hoặc tạo nếu chưa có).
export async function saveDevRelease(projectId: number, mainVersion: string, rc: number | null, content: Content, authorId: number) {
  if (rc != null) {
    const set = { ...content, authorId, updatedAt: new Date() };
    const updated = await db
      .update(devReleases)
      .set(set)
      .where(and(eq(devReleases.projectId, projectId), eq(devReleases.mainVersion, mainVersion), eq(devReleases.rc, rc)))
      .returning({ id: devReleases.id });
    if (updated.length) return { rc, created: false };
    if (!content.body) throw new TaskRuleError(`Chưa có đợt ${releaseVersion(mainVersion, rc)} – tạo mới cần noi_dung`);
    await db.insert(devReleases).values({ projectId, mainVersion, rc, body: content.body, notes: content.notes ?? "", authorId });
    return { rc, created: true };
  }
  if (!content.body) throw new TaskRuleError("Tạo đợt mới cần noi_dung (nhận xét chung)");
  // hai agent ghi cùng lúc có thể lấy trùng số: unique index chặn, thử lại với số kế tiếp
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = await nextRc(projectId, mainVersion);
    const inserted = await db
      .insert(devReleases)
      .values({ projectId, mainVersion, rc: next, body: content.body, notes: content.notes ?? "", authorId })
      .onConflictDoNothing()
      .returning({ id: devReleases.id });
    if (inserted.length) return { rc: next, created: true };
  }
  throw new Error("Không cấp được số rc, hãy thử lại");
}

// Kiểm hết trước khi gắn: việc phải có, cùng dự án, đang Xong trên Dev (hoặc đã Released)
export async function checkReleaseTasks(projectId: number, raw: string[]) {
  const keys: string[] = [];
  const bad: string[] = [];
  for (const r of raw) {
    const key = await resolveTaskKey(r);
    const [t] = key ? await db.select({ projectId: tasks.projectId, status: tasks.status }).from(tasks).where(eq(tasks.key, key)) : [];
    if (!key || !t || t.projectId !== projectId) bad.push(`${r} (không có trong dự án)`);
    else if (!DONE_STATUSES.includes(t.status)) bad.push(`${key} (chưa xong trên Dev)`);
    else if (!keys.includes(key)) keys.push(key);
  }
  if (bad.length) throw new TaskRuleError(`Không gắn được bản release: ${bad.join(", ")}`);
  return keys;
}

export async function tagReleaseTasks(keys: string[], version: string, actor: Actor) {
  for (const key of keys) await updateTaskCore(key, { releasedVersion: version }, actor);
}

export function releaseApi(r: DevRelease, projectCode: string, taskKeys: string[]) {
  const phien_ban = releaseVersion(r.mainVersion, r.rc);
  return {
    du_an: projectCode,
    phien_ban,
    main: r.mainVersion,
    rc: r.rc,
    duong_dan: `/report/releases/${phien_ban}`,
    noi_dung: r.body,
    ghi_chu: r.notes,
    viec: taskKeys,
    tao_luc: r.createdAt,
    cap_nhat_luc: r.updatedAt,
  };
}

export async function taskKeysByVersion(projectId: number) {
  const rows = await db
    .select({ key: tasks.key, version: tasks.releasedVersion })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.releasedVersion)))
    .orderBy(asc(tasks.seq), asc(tasks.key));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.version!, [...(map.get(r.version!) ?? []), r.key]);
  return map;
}
