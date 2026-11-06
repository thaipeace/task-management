import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects, records, tasks, type Project } from "@/db/schema";
import { ApiError } from "./api";
import { nextKey } from "./backlog";
import { RECORD_KINDS } from "./constants";
import { normalizeKey } from "./task-keys";

// Ghi AR / QD qua API. Trường giống backlog.json; gửi null để xoá một trường (trừ trường bắt buộc).
const text = z.string().trim().nullable();

export const decisionFields = z
  .object({
    cau_hoi: z.string().trim().min(1),
    ai: text,
    chan_viec: z.array(z.string()).nullable(),
    chan_phat_hanh: z.boolean().nullable(),
    ghi: text,
    tra_loi: text,
  })
  .partial()
  .strict();

export const riskFields = z
  .object({
    tieu_de: z.string().trim().min(1),
    nguon: text,
    danh_gia: text,
    xem_lai_khi: text,
    ghi: text,
  })
  .partial()
  .strict();

export type RecordKind = keyof typeof RECORD_KINDS;
export const LOAI: Record<string, RecordKind> = { rui_ro: "risk", quyet_dinh: "decision" };
export const loaiOf = (kind: RecordKind) => (kind === "risk" ? "rui_ro" : "quyet_dinh");

// chan_viec: chuẩn hoá id và kiểm tra việc có trong dự án
async function checkTasks(ids: string[], projectId: number) {
  const keys = [...new Set(ids.flatMap((x) => x.split(/[\s,;]+/)).filter(Boolean).map(normalizeKey))];
  if (!keys.length) return keys;
  const found = await db
    .select({ key: tasks.key })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), inArray(tasks.key, keys)));
  const missing = keys.filter((k) => !found.some((f) => f.key === k));
  if (missing.length) throw new ApiError(400, `chan_viec: không có việc ${missing.join(", ")} trong dự án`);
  return keys;
}

function merge(old: Record<string, unknown>, patch: Record<string, unknown>) {
  const out = { ...old };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function createRecord(project: Project, kind: RecordKind, fields: Record<string, unknown>) {
  const required = kind === "risk" ? "tieu_de" : "cau_hoi";
  if (!fields[required]) throw new ApiError(400, `Thiếu ${required}`);
  if (Array.isArray(fields.chan_viec)) fields.chan_viec = await checkTasks(fields.chan_viec as string[], project.id);
  const data = merge({}, fields);
  const key = await db.transaction(async (tx) => {
    const k = await nextKey(tx, project, RECORD_KINDS[kind].prefix);
    await tx.insert(records).values({ key: k, projectId: project.id, kind, data, position: Date.now() % 1e9 });
    return k;
  });
  return { id: key, du_an: project.code, loai: loaiOf(kind), ...data };
}

export async function updateRecord(id: string, body: unknown) {
  const key = id.trim().toUpperCase();
  const [r] = await db
    .select({ key: records.key, kind: records.kind, data: records.data, projectId: records.projectId, du_an: projects.code })
    .from(records)
    .innerJoin(projects, eq(projects.id, records.projectId))
    .where(eq(records.key, key));
  if (!r) throw new ApiError(404, `Không có bản ghi '${key}'`);
  const schema = r.kind === "risk" ? riskFields : decisionFields;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, `Dữ liệu không hợp lệ cho ${key}: ${parsed.error.issues.map((i) => `${i.path.join(".") || i.code}: ${i.message}`).join("; ")}`);
  }
  const fields = parsed.data as Record<string, unknown>;
  const required = r.kind === "risk" ? "tieu_de" : "cau_hoi";
  if (fields[required] === null) throw new ApiError(400, `Không xoá được ${required}`);
  if (Array.isArray(fields.chan_viec)) fields.chan_viec = await checkTasks(fields.chan_viec as string[], r.projectId);
  const data = merge(r.data, fields);
  await db.update(records).set({ data, updatedAt: new Date() }).where(eq(records.key, key));
  return { id: key, du_an: r.du_an, loai: loaiOf(r.kind), ...data };
}
