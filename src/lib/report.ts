import "server-only";
import { and, asc, eq, inArray, isNotNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { records, sprints, taskLogs, tasks, users } from "@/db/schema";
import { AREAS, PRIORITIES, isDone, labelOf, today } from "./constants";
import { stripAreaTag } from "./task-keys";

// Số liệu cho trang Báo cáo. Đếm theo đơn vị công việc: việc con và việc không chia nhỏ.
// Việc cha đã chia thành việc con chỉ là nhóm – đếm cả cha lẫn con sẽ trùng.

export const OPEN = ["moi", "san-sang", "can-thong-tin", "dang-lam", "cho-duyet", "dang-kiem-tra"];
// thứ tự trạng thái trên biểu đồ tiến độ: từ chưa bắt đầu tới xong (huỷ đứng riêng)
export const PROGRESS = ["moi", "san-sang", "can-thong-tin", "dang-lam", "cho-duyet", "dang-kiem-tra", "xong", "released"] as const;

export type ReportTask = {
  key: string;
  title: string; // bỏ thẻ [mảng] – mảng có cột riêng
  area: string;
  areaLabel: string; // "Máy chủ Worker" – dễ đọc với người không làm kỹ thuật
  priority: string;
  estimate: string | null;
  status: string;
  sprint: string | null;
  assignee: string | null;
  createdOn: string;
  doneOn: string | null;
  needsApproval: { ai: string; ly_do: string } | null;
  parentKey: string | null;
};

export async function getReport(projectId: number) {
  const [taskRows, subRows, sprintRows, doneLogs, decisions, riskCount, team] = await Promise.all([
    db
      .select({
        key: tasks.key,
        title: tasks.title,
        area: tasks.area,
        priority: tasks.priority,
        estimate: tasks.estimate,
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
    db.select({ name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
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
      estimate: t.estimate,
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
  const decisionList = decisions.map((d) => ({
    key: d.key,
    question: String(d.data.cau_hoi ?? ""),
    who: String(d.data.ai ?? ""),
    blocks: Array.isArray(d.data.chan_viec) ? (d.data.chan_viec as string[]) : [],
  }));

  return {
    tasks: list,
    totals: {
      all: active.length,
      done: count((t) => isDone(t.status)),
      released: count((t) => t.status === "released"),
      inProgress: count((t) => t.status === "dang-lam"),
      review: count((t) => t.status === "cho-duyet"),
      testing: count((t) => t.status === "dang-kiem-tra"),
      notStarted: count((t) => t.status === "moi" || t.status === "san-sang"),
      blocked: count((t) => t.status === "can-thong-tin"),
      cancelled: count((t) => t.status === "huy"),
      highOpen: count((t) => OPEN.includes(t.status) && ["P0", "P1"].includes(t.priority)),
      p0Open: count((t) => OPEN.includes(t.status) && t.priority === "P0"),
      risks: riskCount,
    },
    releases,
    timeline,
    matrix,
    inProgress: list.filter((t) => ["dang-lam", "cho-duyet", "dang-kiem-tra"].includes(t.status)),
    blocked: list.filter((t) => t.status === "can-thong-tin"),
    recentlyDone: list
      .filter((t) => t.doneOn && t.doneOn >= weekAgo)
      .sort((a, b) => b.doneOn!.localeCompare(a.doneOn!)),
    urgent: openTasks
      .filter((t) => t.priority === "P0" || t.priority === "P1")
      .sort((a, b) => a.priority.localeCompare(b.priority)),
    approvals: openTasks.filter((t) => t.needsApproval),
    decisions: decisionList,
    workload: workload(list, team.map((u) => u.name), decisionList, openTasks),
  };
}

// ---- Khối lượng theo người: cân theo độ nặng và trách nhiệm, không chỉ đếm việc ----

// điểm nặng = cỡ việc × hệ số ưu tiên; việc chưa ước lượng tính như M
export const EFFORT: Record<string, number> = { S: 1, M: 2, L: 4 };
export const PRIORITY_WEIGHT: Record<string, number> = { P0: 2, P1: 1.5, P2: 1, P3: 0.5 };
// chờ duyệt / đang kiểm tra: phần làm chủ yếu đã xong, chỉ còn sửa theo góp ý – tính nửa điểm
const WAITING = ["cho-duyet", "dang-kiem-tra"];
export const WAITING_FACTOR = 0.5;

const points = (t: ReportTask) =>
  (EFFORT[t.estimate ?? ""] ?? EFFORT.M) * (PRIORITY_WEIGHT[t.priority] ?? 1) * (WAITING.includes(t.status) ? WAITING_FACTOR : 1);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

// họ phổ biến – không đủ để nhận ra một người ("Nguyễn Huy Hoàng" không phải "Thai Nguyen")
const SURNAMES = new Set(
  "nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly dinh trinh mai cao lam truong".split(" "),
);

// "ai" trong QD / phê duyệt là chữ tự do ("Thái (kỹ thuật) + báo anh Hoàng") – khớp cả tên,
// hoặc một chữ trong tên không phải họ (tên viết kiểu "Thai Nguyen" hay "Nguyễn Văn Thái" đều nhận ra "Thái")
function namedIn(text: string, name: string) {
  const words = (x: string) => fold(x).split(/[^a-z0-9]+/).filter(Boolean);
  const t = ` ${words(text).join(" ")} `;
  const n = words(name);
  return t.includes(` ${n.join(" ")} `) || n.some((w) => w.length > 1 && !SURNAMES.has(w) && t.includes(` ${w} `));
}

const DAY = 86_400_000;

function workload(
  list: ReportTask[],
  team: string[],
  decisions: { key: string; who: string }[],
  openTasks: ReportTask[],
) {
  const since = new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10);
  const names = [...new Set([...team, ...list.flatMap((t) => (t.assignee ? [t.assignee] : []))])];
  const round = (n: number) => Math.round(n * 10) / 10;

  const people = names
    .map((name) => {
      const mine = list.filter((t) => t.assignee === name);
      const open = mine.filter((t) => OPEN.includes(t.status));
      const recent = mine.filter((t) => t.doneOn && t.doneOn >= since);
      return {
        name,
        openCount: open.length,
        load: round(open.reduce((a, t) => a + points(t), 0)),
        urgent: open.filter((t) => t.priority === "P0" || t.priority === "P1").length,
        p0: open.filter((t) => t.priority === "P0").length,
        doing: open.filter((t) => t.status === "dang-lam").length,
        waiting: open.filter((t) => WAITING.includes(t.status)).length,
        unestimated: open.filter((t) => !t.estimate).length,
        doneRecent: recent.length,
        doneRecentPoints: round(recent.reduce((a, t) => a + (EFFORT[t.estimate ?? ""] ?? EFFORT.M) * (PRIORITY_WEIGHT[t.priority] ?? 1), 0)),
        decisions: decisions.filter((d) => d.who && namedIn(d.who, name)).map((d) => d.key),
        approvals: openTasks.filter((t) => t.needsApproval?.ai && namedIn(t.needsApproval.ai, name)).map((t) => t.key),
        hasWork: mine.some((t) => t.status !== "huy"),
      };
    })
    // người chưa từng nhận việc và không giữ quyết định nào thì không đưa vào bảng
    .filter((p) => p.hasWork || p.decisions.length || p.approvals.length);

  // mức trung bình chia đều cho những người đang nhận việc trong dự án
  const workers = people.filter((p) => p.hasWork);
  const avg = workers.length ? workers.reduce((a, p) => a + p.load, 0) / workers.length : 0;
  const rows = people
    .map(({ hasWork, ...p }) => {
      const flags: string[] = [];
      if (avg > 0 && p.load > avg * 1.5) flags.push(`Quá tải – gấp ${round(p.load / avg)} lần mức trung bình`);
      else if (hasWork && avg > 0 && p.load < avg * 0.5) flags.push("Nhẹ việc – có thể nhận thêm");
      if (p.p0 >= 2) flags.push(`Giữ ${p.p0} việc chặn phát hành`);
      if (p.doing >= 3) flags.push(`Làm song song ${p.doing} việc`);
      if (p.decisions.length + p.approvals.length >= 3) {
        flags.push(`Đang là người quyết ${p.decisions.length + p.approvals.length} chỗ – dễ thành nút thắt`);
      }
      return { ...p, share: avg ? round(p.load / avg) : 0, flags };
    })
    .sort((a, b) => b.load - a.load || b.urgent - a.urgent || a.name.localeCompare(b.name));

  const unassigned = openTasks.filter((t) => !t.assignee);
  return {
    rows,
    avg: round(avg),
    unassigned: {
      count: unassigned.length,
      load: round(unassigned.reduce((a, t) => a + points(t), 0)),
      urgent: unassigned.filter((t) => t.priority === "P0" || t.priority === "P1").length,
    },
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;

// ---- Tóm tắt bằng lời cho người đọc không làm kỹ thuật ----

const STATUS_WORD: Record<string, string> = {
  moi: "chưa bắt đầu",
  "san-sang": "sẵn sàng làm",
  "can-thong-tin": "cần thêm thông tin",
  "dang-lam": "đang làm",
  "cho-duyet": "chờ duyệt",
  "dang-kiem-tra": "đang kiểm tra",
  xong: "xong trên dev",
  released: "đã release",
  huy: "đã huỷ",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
// số kiểu Việt: 1,5
export const fmt = (n: number) => String(n).replace(".", ",");

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
    `${projectName} hiện có ${T.all} việc: đã xong ${T.done} (${pct(T.done, T.all)}%${T.released ? `, trong đó ${T.released} đã release` : ""}), đang làm ${T.inProgress}, chờ duyệt ${T.review}, đang kiểm tra ${T.testing}, chưa bắt đầu ${T.notStarted}${T.blocked ? `, cần thêm thông tin ${T.blocked}` : ""}.`,
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
  if (r.blocked.length) {
    sections.push({
      title: "Cần thêm thông tin",
      intro: "Bị chặn hoặc chờ chốt phương án trước khi làm tiếp.",
      lines: r.blocked.map((t) => line(t, false)),
    });
  }
  const W = r.workload;
  if (W.rows.length) {
    const top = W.rows[0];
    const over = W.rows.filter((p) => p.flags.some((f) => f.startsWith("Quá tải")));
    sections.push({
      title: "Khối lượng theo người",
      intro: `Cân theo độ nặng chứ không chỉ đếm việc: điểm = cỡ việc (S 1, M 2, L 4) × ưu tiên (P0 ×2, P1 ×1,5, P2 ×1, P3 ×0,5); việc đang chờ duyệt / kiểm tra tính nửa điểm. Trung bình mỗi người đang giữ ${fmt(W.avg)} điểm.${
        over.length ? ` Cần san bớt việc của ${over.map((p) => p.name).join(", ")}.` : top.load ? " Việc đang chia khá đều." : ""
      }`,
      lines: [
        ...W.rows.map((p) => {
          const parts = [
            `${p.name}: ${p.openCount} việc chưa xong, ${fmt(p.load)} điểm${W.avg ? ` (${fmt(p.share)}× trung bình)` : ""}`,
            p.urgent ? `${p.urgent} việc gấp` : "",
            p.waiting ? `${p.waiting} việc đang chờ duyệt / kiểm tra` : "",
            p.doneRecent ? `xong ${p.doneRecent} việc (${fmt(p.doneRecentPoints)} điểm) trong 14 ngày` : "chưa xong việc nào trong 14 ngày",
            p.decisions.length ? `là người quyết ${p.decisions.join(", ")}` : "",
            p.approvals.length ? `cần phê duyệt ${p.approvals.join(", ")}` : "",
          ].filter(Boolean);
          return parts.join(", ") + "." + (p.flags.length ? ` ⚠ ${p.flags.join("; ")}.` : "");
        }),
        ...(W.unassigned.count
          ? [`Chưa giao cho ai: ${W.unassigned.count} việc, ${fmt(W.unassigned.load)} điểm${W.unassigned.urgent ? `, trong đó ${W.unassigned.urgent} việc gấp` : ""}.`]
          : []),
      ],
    });
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
