import { and, asc, eq, isNotNull, max } from "drizzle-orm";
import { db } from "@/db";
import { devReleases, tasks } from "@/db/schema";
import { DONE_STATUSES } from "./constants";
import { TaskRuleError, resolveTaskKey, updateTaskCore, type Actor } from "./task-service";

export const MAIN_VERSION = /^\d+\.\d+\.\d+$/;

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

async function nextRc(projectId: number, mainVersion: string) {
  const [row] = await db
    .select({ rc: max(devReleases.rc) })
    .from(devReleases)
    .where(and(eq(devReleases.projectId, projectId), eq(devReleases.mainVersion, mainVersion)));
  return (row?.rc ?? 0) + 1;
}

// Không có rc: tạo đợt mới với số kế tiếp. Có rc: ghi đè đợt đó (hoặc tạo nếu chưa có).
export async function saveDevRelease(projectId: number, mainVersion: string, rc: number | null, body: string, authorId: number) {
  if (rc != null) {
    await db
      .insert(devReleases)
      .values({ projectId, mainVersion, rc, body, authorId })
      .onConflictDoUpdate({
        target: [devReleases.projectId, devReleases.mainVersion, devReleases.rc],
        set: { body, authorId, updatedAt: new Date() },
      });
    return { rc, created: false };
  }
  // hai agent ghi cùng lúc có thể lấy trùng số: unique index chặn, thử lại với số kế tiếp
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = await nextRc(projectId, mainVersion);
    const inserted = await db
      .insert(devReleases)
      .values({ projectId, mainVersion, rc: next, body, authorId })
      .onConflictDoNothing()
      .returning({ id: devReleases.id });
    if (inserted.length) return { rc: next, created: true };
  }
  throw new Error("Không cấp được số rc, hãy thử lại");
}

// Việc đã gắn bản release, gom theo version
export async function tasksByVersion(projectId: number) {
  const rows = await db
    .select({ key: tasks.key, title: tasks.title, status: tasks.status, version: tasks.releasedVersion })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.releasedVersion)))
    .orderBy(asc(tasks.seq), asc(tasks.key));
  const map = new Map<string, typeof rows>();
  for (const r of rows) map.set(r.version!, [...(map.get(r.version!) ?? []), r]);
  return map;
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

export function releaseApi(r: typeof devReleases.$inferSelect, projectCode: string) {
  return {
    du_an: projectCode,
    phien_ban: releaseVersion(r.mainVersion, r.rc),
    main: r.mainVersion,
    rc: r.rc,
    noi_dung: r.body,
    tao_luc: r.createdAt,
    cap_nhat_luc: r.updatedAt,
  };
}
