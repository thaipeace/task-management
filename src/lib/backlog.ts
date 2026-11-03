import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  counters,
  meta,
  records,
  sprints,
  taskLogs,
  tasks,
  users,
  type Approval,
  type Related,
} from "@/db/schema";
import { today } from "./constants";

// Các mảng / khoá có bảng riêng; mọi khoá cấp cao khác đi vào bảng meta.
const STRUCTURED = ["dem_id", "dot", "viec", "chap_nhan_rui_ro", "cho_quyet_dinh"];
const ORDER_KEY = "__thu_tu_khoa";

const TASK_FIELDS = [
  "id", "tieu_de", "mang", "loai", "dot", "uu_tien", "trang_thai", "uoc_luong", "mo_ta",
  "bang_chung", "viec_can_lam", "tieu_chi_xong", "kiem_thu", "rui_ro", "can_phe_duyet",
  "phu_thuoc", "lien_quan", "nhanh_goi_y", "nguon", "tao_luc", "cap_nhat_luc", "nhat_ky",
  "nguoi_lam",
];

const strList = z
  .array(z.unknown())
  .nullish()
  .transform((v) => (v ?? []).map((x) => String(x)));
// issue / pr: giữ nguyên kiểu (số hoặc chuỗi) như trong tệp
const scalar = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === "" || v == null ? null : v));
const optStr = z
  .unknown()
  .nullish()
  .transform((v) => (v == null || v === "" ? null : String(v)));

const taskSchema = z
  .object({
    id: z.string().min(1),
    tieu_de: z.string().default(""),
    mang: z.string().default(""),
    loai: z.string().default(""),
    dot: optStr,
    uu_tien: z.string().default("P2"),
    trang_thai: z.string().default("moi"),
    uoc_luong: optStr,
    mo_ta: z.string().nullish().transform((v) => v ?? ""),
    bang_chung: strList,
    viec_can_lam: strList,
    tieu_chi_xong: strList,
    kiem_thu: strList,
    rui_ro: z.unknown().nullish().transform((v) => (v == null ? "" : Array.isArray(v) ? v.join("\n") : String(v))),
    can_phe_duyet: z
      .object({ ai: z.string().default(""), ly_do: z.string().default("") })
      .nullish()
      .transform((v) => v ?? null),
    phu_thuoc: strList,
    lien_quan: z
      .object({
        issue: scalar,
        pr: scalar,
        viec: strList,
        tai_lieu: strList,
      })
      .nullish()
      .transform((v) => v ?? { issue: null, pr: null, viec: [], tai_lieu: [] }),
    nhanh_goi_y: optStr,
    nguon: z.string().nullish().transform((v) => v ?? ""),
    tao_luc: optStr,
    cap_nhat_luc: optStr,
    nhat_ky: z
      .array(z.object({ ngay: z.string(), ghi: z.string() }))
      .nullish()
      .transform((v) => v ?? []),
    nguoi_lam: optStr,
  })
  .passthrough();

const recordSchema = z.object({ id: z.string().min(1) }).passthrough();

export const backlogSchema = z
  .object({
    dem_id: z.record(z.string(), z.object({ tiep_theo: z.number().int() })).default({}),
    dot: z.record(z.string(), z.string()).default({}),
    viec: z.array(taskSchema).default([]),
    chap_nhan_rui_ro: z.array(recordSchema).default([]),
    cho_quyet_dinh: z.array(recordSchema).default([]),
  })
  .passthrough();

export type ImportSummary = {
  tasks: number;
  created: number;
  updated: number;
  sprints: number;
  risks: number;
  decisions: number;
  logs: number;
};

function idNumber(key: string) {
  const m = /^([A-Z]+)-(\d+)$/.exec(key);
  return m ? { prefix: m[1], n: Number(m[2]) } : null;
}

export async function importBacklog(
  raw: unknown,
  mode: "merge" | "replace",
): Promise<ImportSummary> {
  const parsed = backlogSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Tệp không đúng cấu trúc backlog: ${issue.path.join(".")} – ${issue.message}`);
  }
  const data = parsed.data;
  const rawObj = raw as Record<string, unknown>;
  const date = today();

  return db.transaction(async (tx) => {
    if (mode === "replace") {
      await tx.delete(tasks); // xoá kèm nhat_ky + bình luận (cascade)
      await tx.delete(records);
      await tx.delete(sprints);
      await tx.delete(counters);
      await tx.delete(meta);
    }

    // meta: mọi khoá cấp cao không có bảng riêng, cùng thứ tự khoá để export y như cũ
    const metaRows = Object.keys(rawObj)
      .filter((k) => !STRUCTURED.includes(k))
      .map((k) => ({ key: k, value: rawObj[k] }));
    metaRows.push({ key: ORDER_KEY, value: Object.keys(rawObj) });
    for (const row of metaRows) {
      await tx
        .insert(meta)
        .values(row)
        .onConflictDoUpdate({ target: meta.key, set: { value: row.value } });
    }

    // đợt
    const sprintCodes = new Map(Object.entries(data.dot));
    for (const t of data.viec) if (t.dot && !sprintCodes.has(t.dot)) sprintCodes.set(t.dot, "");
    const [{ maxPos }] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${sprints.position}), -1)` })
      .from(sprints);
    let pos = Number(maxPos) + 1;
    for (const [code, description] of sprintCodes) {
      await tx
        .insert(sprints)
        .values({ code, description, position: pos++ })
        .onConflictDoUpdate({
          target: sprints.code,
          set: description ? { description } : { code },
        });
    }

    // người làm (nếu tệp do app này export)
    const emails = [...new Set(data.viec.map((t) => t.nguoi_lam).filter(Boolean))] as string[];
    const userByEmail = new Map<string, number>();
    if (emails.length) {
      const found = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, emails));
      for (const u of found) userByEmail.set(u.email, u.id);
    }

    // việc
    const keys = data.viec.map((t) => t.id);
    const existing = new Set(
      keys.length
        ? (await tx.select({ key: tasks.key }).from(tasks).where(inArray(tasks.key, keys))).map(
            (r) => r.key,
          )
        : [],
    );
    let created = 0;
    let index = 0;
    for (const t of data.viec) {
      const extra = Object.fromEntries(
        Object.entries(t).filter(([k]) => !TASK_FIELDS.includes(k)),
      );
      const values = {
        key: t.id,
        title: t.tieu_de,
        area: t.mang || idNumber(t.id)?.prefix || "BE",
        type: t.loai || "loi",
        sprint: t.dot,
        priority: t.uu_tien,
        status: t.trang_thai,
        estimate: t.uoc_luong,
        description: t.mo_ta,
        evidence: t.bang_chung,
        steps: t.viec_can_lam,
        doneCriteria: t.tieu_chi_xong,
        tests: t.kiem_thu,
        risk: t.rui_ro,
        approval: t.can_phe_duyet as Approval,
        dependsOn: t.phu_thuoc,
        related: t.lien_quan as Related,
        branch: t.nhanh_goi_y,
        source: t.nguon,
        createdOn: t.tao_luc ?? date,
        updatedOn: t.cap_nhat_luc ?? t.tao_luc ?? date,
        extra,
        updatedAt: new Date(),
      };
      const assigneeId = t.nguoi_lam ? userByEmail.get(t.nguoi_lam) : undefined;
      const updateSet: Partial<typeof values> = { ...values };
      delete updateSet.key;
      await tx
        .insert(tasks)
        .values({ ...values, assigneeId: assigneeId ?? null, position: (index + 1) * 1000 })
        .onConflictDoUpdate({
          target: tasks.key,
          set: assigneeId !== undefined ? { ...updateSet, assigneeId } : updateSet,
        });
      if (!existing.has(t.id)) created++;
      index++;
    }

    // nhật ký: chỉ thêm dòng chưa có (theo ngày + nội dung) để không mất dòng ghi trong app
    let logCount = 0;
    if (keys.length) {
      const have = new Set(
        (
          await tx
            .select({ k: taskLogs.taskKey, d: taskLogs.date, t: taskLogs.text })
            .from(taskLogs)
            .where(inArray(taskLogs.taskKey, keys))
        ).map((r) => `${r.k}|${r.d}|${r.t}`),
      );
      const rows = data.viec.flatMap((t) =>
        t.nhat_ky
          .filter((l) => !have.has(`${t.id}|${l.ngay}|${l.ghi}`))
          .map((l) => ({ taskKey: t.id, date: l.ngay, text: l.ghi })),
      );
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(taskLogs).values(rows.slice(i, i + 500));
      }
      logCount = rows.length;
    }

    // AR / QD
    const recordRows = [
      ...data.chap_nhan_rui_ro.map((r, i) => ({ r, kind: "risk" as const, i })),
      ...data.cho_quyet_dinh.map((r, i) => ({ r, kind: "decision" as const, i })),
    ];
    for (const { r, kind, i } of recordRows) {
      const { id, ...rest } = r;
      await tx
        .insert(records)
        .values({ key: id, kind, data: rest, position: i })
        .onConflictDoUpdate({
          target: records.key,
          set: { kind, data: rest, position: i, updatedAt: new Date() },
        });
    }

    // bộ đếm: lấy số lớn nhất giữa tệp, DB và id đã dùng
    const nextByPrefix = new Map<string, number>();
    for (const [p, v] of Object.entries(data.dem_id)) nextByPrefix.set(p, v.tiep_theo);
    for (const k of [...keys, ...recordRows.map((x) => x.r.id)]) {
      const parsedId = idNumber(k);
      if (!parsedId) continue;
      nextByPrefix.set(
        parsedId.prefix,
        Math.max(nextByPrefix.get(parsedId.prefix) ?? 1, parsedId.n + 1),
      );
    }
    for (const [prefix, next] of nextByPrefix) {
      await tx
        .insert(counters)
        .values({ prefix, next })
        .onConflictDoUpdate({
          target: counters.prefix,
          set: { next: sql`greatest(${counters.next}, excluded.next)` },
        });
    }

    return {
      tasks: data.viec.length,
      created,
      updated: data.viec.length - created,
      sprints: sprintCodes.size,
      risks: data.chap_nhan_rui_ro.length,
      decisions: data.cho_quyet_dinh.length,
      logs: logCount,
    };
  });
}

const PREFIX_ORDER = ["BE", "FE", "OPS", "DOC", "AR", "QD"];
function prefixRank(p: string) {
  const i = PREFIX_ORDER.indexOf(p);
  return i === -1 ? PREFIX_ORDER.length : i;
}

export async function exportBacklog() {
  const [metaRows, counterRows, sprintRows, taskRows, logRows, recordRows] = await Promise.all([
    db.select().from(meta),
    db.select().from(counters).orderBy(asc(counters.prefix)),
    db.select().from(sprints).orderBy(asc(sprints.position), asc(sprints.code)),
    db
      .select({ task: tasks, email: users.email })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .orderBy(asc(tasks.seq)),
    db.select().from(taskLogs).orderBy(asc(taskLogs.id)),
    db.select().from(records).orderBy(asc(records.kind), asc(records.position), asc(records.key)),
  ]);

  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
  const logsByTask = new Map<string, { ngay: string; ghi: string }[]>();
  for (const l of logRows) {
    const list = logsByTask.get(l.taskKey) ?? [];
    list.push({ ngay: l.date, ghi: l.text });
    logsByTask.set(l.taskKey, list);
  }

  const structured: Record<string, unknown> = {
    dem_id: Object.fromEntries(
      counterRows
        .sort((a, b) => prefixRank(a.prefix) - prefixRank(b.prefix) || a.prefix.localeCompare(b.prefix))
        .map((c) => [c.prefix, { tiep_theo: c.next }]),
    ),
    dot: Object.fromEntries(sprintRows.map((s) => [s.code, s.description])),
    viec: taskRows.map(({ task: t, email }) => ({
      id: t.key,
      tieu_de: t.title,
      mang: t.area,
      loai: t.type,
      dot: t.sprint,
      uu_tien: t.priority,
      trang_thai: t.status,
      uoc_luong: t.estimate,
      mo_ta: t.description,
      bang_chung: t.evidence,
      viec_can_lam: t.steps,
      tieu_chi_xong: t.doneCriteria,
      kiem_thu: t.tests,
      rui_ro: t.risk,
      can_phe_duyet: t.approval ? { ai: t.approval.ai, ly_do: t.approval.ly_do } : null,
      phu_thuoc: t.dependsOn,
      lien_quan: {
        issue: t.related.issue,
        pr: t.related.pr,
        viec: t.related.viec,
        tai_lieu: t.related.tai_lieu,
      },
      nhanh_goi_y: t.branch,
      nguon: t.source,
      tao_luc: t.createdOn,
      cap_nhat_luc: t.updatedOn,
      nhat_ky: logsByTask.get(t.key) ?? [],
      ...(email ? { nguoi_lam: email } : {}),
      ...t.extra,
    })),
    chap_nhan_rui_ro: recordRows
      .filter((r) => r.kind === "risk")
      .map((r) => ({ id: r.key, ...r.data })),
    cho_quyet_dinh: recordRows
      .filter((r) => r.kind === "decision")
      .map((r) => ({ id: r.key, ...r.data })),
  };

  const order = (metaMap.get(ORDER_KEY) as string[] | undefined) ?? [
    "_huong_dan", "phien_ban_cau_truc", "goc_ma", ...STRUCTURED, "ghi_chu_ngoai_pham_vi",
  ];
  const out: Record<string, unknown> = {};
  const all = [...order, ...STRUCTURED, ...metaMap.keys()];
  for (const k of all) {
    if (k === ORDER_KEY || k in out) continue;
    if (STRUCTURED.includes(k)) out[k] = structured[k];
    else if (metaMap.has(k)) out[k] = metaMap.get(k);
  }
  return out;
}

// Cấp id tiếp theo cho tiền tố (BE, FE, AR, QD …) – an toàn khi nhiều người tạo cùng lúc
export async function nextKey(
  tx: Pick<typeof db, "insert">,
  prefix: string,
): Promise<string> {
  const [row] = await tx
    .insert(counters)
    .values({ prefix, next: 2 })
    .onConflictDoUpdate({ target: counters.prefix, set: { next: sql`${counters.next} + 1` } })
    .returning({ next: counters.next });
  return `${prefix}-${String(row.next - 1).padStart(3, "0")}`;
}

