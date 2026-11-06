import "server-only";
import { and, asc, eq, inArray, isNotNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { records, sprints, taskLogs, tasks, users } from "@/db/schema";
import { AREAS, PRIORITIES, isDone, labelOf, today } from "./constants";
import { stripAreaTag } from "./task-keys";

// Số liệu cho trang Báo cáo. Đếm theo đơn vị công việc: việc con và việc không chia nhỏ.
// Việc cha đã chia thành việc con chỉ là nhóm – đếm cả cha lẫn con sẽ trùng.

export const OPEN = ["moi", "san-sang", "dang-lam", "cho-duyet"];
// thứ tự trạng thái trên biểu đồ tiến độ: từ chưa bắt đầu tới xong (huỷ đứng riêng)
export const PROGRESS = ["moi", "san-sang", "dang-lam", "cho-duyet", "xong", "released"] as const;

export type ReportTask = {
  key: string;
  title: string; // bỏ thẻ [mảng] – mảng có cột riêng
  area: string;
  areaLabel: string; // "Máy chủ Worker" – dễ đọc với người không làm kỹ thuật
  priority: string;
  status: string;
  sprint: string | null;
  assignee: string | null;
  createdOn: string;
  doneOn: string | null;
  needsApproval: { ai: string; ly_do: string } | null;
  parentKey: string | null;
};

export async function getReport(projectId: number) {
  const [taskRows, subRows, sprintRows, doneLogs, decisions, riskCount] = await Promise.all([
    db
      .select({
        key: tasks.key,
        title: tasks.title,
        area: tasks.area,
        priority: tasks.priority,
        status: tasks.status,
        sprint: tasks.sprint,
        createdOn: tasks.createdOn,
        updatedOn: tasks.updatedOn,
        approval: tasks.approval,
        assignee: users.name,
        parentKey: tasks.parentKey,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.seq)),
    db
      .select({ parent: tasks.parentKey })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.parentKey))),
    db
      .select()
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(asc(sprints.position), asc(sprints.code)),
    // ngày xong = lần cuối nhật ký ghi chuyển sang "Xong…" (gồm nhãn cũ "Xong" và "Xong trên Dev") hoặc "Released"
    db
      .select({ key: taskLogs.taskKey, date: taskLogs.date })
      .from(taskLogs)
      .innerJoin(tasks, eq(tasks.key, taskLogs.taskKey))
      .where(and(eq(tasks.projectId, projectId), or(like(taskLogs.text, "%→ Xong%"), like(taskLogs.text, "%→ Released%"))))
      .orderBy(asc(taskLogs.id)),
    db
      .select({ key: records.key, data: records.data })
      .from(records)
      .where(and(eq(records.projectId, projectId), eq(records.kind, "decision")))
      .orderBy(asc(records.position), asc(records.key)),
    db
      .select({ key: records.key })
      .from(records)
      .where(and(eq(records.projectId, projectId), inArray(records.kind, ["risk"])))
      .then((r) => r.length),
  ]);

  const doneOn = new Map<string, string>();
  for (const l of doneLogs) doneOn.set(l.key, l.date);
  const parents = new Set(subRows.map((s) => s.parent));

  const list: ReportTask[] = taskRows
    .filter((t) => !parents.has(t.key))
    .map((t) => ({
      key: t.key,
      title: stripAreaTag(t.title),
      area: t.area,
      areaLabel: (labelOf(AREAS, t.area).split("·")[1] ?? t.area).trim(),
      priority: t.priority,
      status: t.status,
      sprint: t.sprint,
      assignee: t.assignee,
      createdOn: t.createdOn,
      // việc import đã xong sẵn không có dòng nhật ký chuyển trạng thái – lấy ngày cập nhật
      doneOn: isDone(t.status) ? (doneOn.get(t.key) ?? t.updatedOn) : null,
      needsApproval: t.approval,
      parentKey: t.parentKey,
    }));

  const count = (f: (t: ReportTask) => boolean) => list.filter(f).length;
  const active = list.filter((t) => t.status !== "huy");

  // tiến độ từng đợt (đợt = mốc phát hành), thêm nhóm chưa xếp đợt nếu có
  const groups = [
    ...sprintRows.map((s) => ({ code: s.code as string | null, description: s.description })),
    { code: null, description: "Việc chưa xếp vào đợt nào" },
  ];
  const releases = groups
    .map((g) => {
      const items = list.filter((t) => t.sprint === g.code);
      const byStatus = Object.fromEntries(
        [...PROGRESS, "huy"].map((s) => [s, items.filter((t) => t.status === s).length]),
      ) as Record<string, number>;
      const total = items.length - byStatus.huy;
      return {
        code: g.code,
        description: g.description,
        items,
        byStatus,
        total,
        done: byStatus.xong + byStatus.released,
        pct: total ? Math.round(((byStatus.xong + byStatus.released) / total) * 100) : 0,
        highOpen: items.filter((t) => OPEN.includes(t.status) && ["P0", "P1"].includes(t.priority)).length,
      };
    })
    .filter((r) => r.items.length > 0);

  // việc theo thời gian: tổng việc đã nhận và số đã xong, cộng dồn theo ngày
  const days = new Set<string>([today()]);
  for (const t of active) {
    days.add(t.createdOn);
    if (t.doneOn) days.add(t.doneOn);
  }
  const timeline = [...days]
    .sort()
    .map((d) => ({
      date: d,
      scope: active.filter((t) => t.createdOn <= d).length,
      done: active.filter((t) => t.doneOn && t.doneOn <= d).length,
    }));

  // việc chưa xong theo mảng × ưu tiên
  const openTasks = list.filter((t) => OPEN.includes(t.status));
  const matrix = AREAS.map((a) => ({
    area: a.value,
    label: (a.label.split("·")[1] ?? a.value).trim(),
    cells: PRIORITIES.map((p) => ({
      priority: p.value,
      n: openTasks.filter((t) => t.area === a.value && t.priority === p.value).length,
    })),
  })).filter((r) => r.cells.some((c) => c.n > 0));

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  return {
    tasks: list,
    totals: {
      all: active.length,
      done: count((t) => isDone(t.status)),
      released: count((t) => t.status === "released"),
      inProgress: count((t) => t.status === "dang-lam"),
      review: count((t) => t.status === "cho-duyet"),
      notStarted: count((t) => t.status === "moi" || t.status === "san-sang"),
      cancelled: count((t) => t.status === "huy"),
      highOpen: count((t) => OPEN.includes(t.status) && ["P0", "P1"].includes(t.priority)),
      p0Open: count((t) => OPEN.includes(t.status) && t.priority === "P0"),
      risks: riskCount,
    },
    releases,
    timeline,
    matrix,
    inProgress: list.filter((t) => t.status === "dang-lam" || t.status === "cho-duyet"),
    recentlyDone: list
      .filter((t) => t.doneOn && t.doneOn >= weekAgo)
      .sort((a, b) => b.doneOn!.localeCompare(a.doneOn!)),
    urgent: openTasks
      .filter((t) => t.priority === "P0" || t.priority === "P1")
      .sort((a, b) => a.priority.localeCompare(b.priority)),
    approvals: openTasks.filter((t) => t.needsApproval),
    decisions: decisions.map((d) => ({
      key: d.key,
      question: String(d.data.cau_hoi ?? ""),
      who: String(d.data.ai ?? ""),
      blocks: Array.isArray(d.data.chan_viec) ? (d.data.chan_viec as string[]) : [],
    })),
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;

// ---- Tóm tắt bằng lời cho người đọc không làm kỹ thuật ----

const STATUS_WORD: Record<string, string> = {
  moi: "chưa bắt đầu",
  "san-sang": "sẵn sàng làm",
  "dang-lam": "đang làm",
  "cho-duyet": "chờ duyệt",
  xong: "xong trên dev",
  released: "đã release",
  huy: "đã huỷ",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function line(t: ReportTask, withStatus = true) {
  const who = t.assignee ? `, ${t.assignee}` : "";
  const sub = t.parentKey ? `, thuộc ${t.parentKey}` : "";
  const st = withStatus ? ` – ${STATUS_WORD[t.status] ?? t.status}${who}${sub}` : who ? ` – ${t.assignee}` : "";
  return `${t.title} [${t.areaLabel}] (${t.key})${st}`;
}

export type SummarySection = { title: string; intro?: string; lines: string[] };

export function buildSummary(r: Report, projectName: string): SummarySection[] {
  const T = r.totals;
  const open = T.all - T.done;
  const sections: SummarySection[] = [];

  const headline = [
    `${projectName} hiện có ${T.all} việc: đã xong ${T.done} (${pct(T.done, T.all)}%${T.released ? `, trong đó ${T.released} đã release` : ""}), đang làm ${T.inProgress}, chờ duyệt ${T.review}, chưa bắt đầu ${T.notStarted}.`,
    T.highOpen
      ? `Còn ${T.highOpen} việc ưu tiên cao chưa xong${T.p0Open ? `, trong đó ${T.p0Open} việc chặn phát hành (P0)` : ""}.`
      : "Không còn việc ưu tiên cao nào tồn đọng.",
    r.decisions.length ? `${r.decisions.length} câu hỏi đang chờ quyết định.` : "",
    r.approvals.length ? `${r.approvals.length} việc cần phê duyệt trước khi làm.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  sections.push({ title: "Tổng quan", intro: headline, lines: [] });

  const best = [...r.releases].filter((x) => x.code && x.total).sort((a, b) => b.pct - a.pct)[0];
  sections.push({
    title: "Theo từng đợt phát hành",
    intro:
      open === 0
        ? "Mọi đợt đã xong."
        : best
          ? `Đợt tiến xa nhất: ${best.code} (${best.pct}%).`
          : undefined,
    lines: r.releases.map((x) => {
      const left = x.total - x.done;
      const parts = [
        `${x.code ?? "Chưa xếp đợt"}${x.code ? ` – ${x.description}` : ""}: xong ${x.done}/${x.total} (${x.pct}%)`,
        left ? `còn ${left} việc` : "đã hoàn tất",
        x.highOpen ? `${x.highOpen} việc ưu tiên cao chưa xong` : "",
        x.byStatus["dang-lam"] ? `${x.byStatus["dang-lam"]} đang làm` : "",
      ].filter(Boolean);
      return parts.join(", ") + ".";
    }),
  });

  if (r.inProgress.length) {
    sections.push({ title: "Đang làm và chờ duyệt", lines: r.inProgress.map((t) => line(t)) });
  }
  if (r.urgent.length) {
    sections.push({
      title: "Việc gấp chưa xong (P0 / P1)",
      lines: r.urgent.map((t) => `${t.priority === "P0" ? "Chặn phát hành" : "Làm ngay"}: ${line(t)}`),
    });
  }
  if (r.decisions.length) {
    sections.push({
      title: "Cần quyết định",
      lines: r.decisions.map(
        (d) =>
          `${d.question.length > 220 ? d.question.slice(0, 217) + "…" : d.question} (${d.key}${d.who ? `, người quyết: ${d.who}` : ""}${d.blocks.length ? `, đang chặn ${d.blocks.join(", ")}` : ""})`,
      ),
    });
  }
  if (r.approvals.length) {
    sections.push({
      title: "Cần phê duyệt",
      lines: r.approvals.map((t) => `${line(t, false)} – ${t.needsApproval!.ai}: ${t.needsApproval!.ly_do}`),
    });
  }
  sections.push({
    title: "Đã xong trong 7 ngày qua",
    lines: r.recentlyDone.length ? r.recentlyDone.map((t) => `${t.doneOn!.slice(8, 10)}/${t.doneOn!.slice(5, 7)}: ${line(t, false)}`) : ["Chưa có việc nào xong trong tuần này."],
  });
  return sections;
}

export function summaryText(sections: SummarySection[], projectName: string, date: string) {
  const out = [`BÁO CÁO CÔNG VIỆC – ${projectName} – ${date}`, ""];
  for (const s of sections) {
    out.push(s.title.toUpperCase());
    if (s.intro) out.push(s.intro);
    for (const l of s.lines) out.push(`• ${l}`);
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
