import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, records, taskLogs, tasks, users, weeklyReports } from "@/db/schema";
import { isDone, today } from "./constants";
import { EFFORT, OPEN, PRIORITY_WEIGHT } from "./report";
import { stripAreaTag } from "./task-keys";

// Báo cáo tuần lấy mục tiêu làm chuẩn: mục tiêu nào đạt / đúng nhịp / chậm, tuần này xong gì, đang làm gì,
// và kế hoạch tuần tới vừa với sức làm thật (điểm cỡ việc xong mỗi tuần của từng người, 3 tuần gần nhất).
// Số liệu tính ở đây; lời văn do Claude viết mỗi thứ Bảy (GET /api/v1/weekly → PUT /api/v1/weekly).

export const GOAL_STATUSES = [
  { value: "dang-theo", label: "Đang theo" },
  { value: "dat", label: "Đã đạt" },
  { value: "khong-dat", label: "Không đạt" },
  { value: "bo", label: "Bỏ" },
] as const;

// đánh giá mục tiêu đang theo – so tiến độ thật với nhịp đều từ ngày bắt đầu tới hạn
export const PACE = {
  "du-dieu-kien": { label: "Xong hết việc – chờ xác nhận đạt", tone: "good" },
  "dung-nhip": { label: "Đúng nhịp", tone: "good" },
  cham: { label: "Chậm", tone: "warn" },
  "khong-kip": { label: "Không kịp hạn nếu giữ nhịp này", tone: "bad" },
  "qua-han": { label: "Quá hạn", tone: "bad" },
  "chua-co-viec": { label: "Chưa gắn việc nào", tone: "warn" },
} as const;
export type Pace = keyof typeof PACE;

const WAITING = ["cho-duyet", "dang-kiem-tra"];
const DOING = ["dang-lam", ...WAITING];
const DAY = 86_400_000;
// người chưa có lịch sử xong việc: giả định làm được chừng này điểm cỡ việc / tuần (một việc M)
const MIN_CAPACITY = 2;
// việc đang làm không có nhật ký / cập nhật quá số ngày này thì coi là đứng yên
const STALE_DAYS = 5;

const toDay = (d: string) => Date.parse(d + "T00:00:00Z");
const fromDay = (n: number) => new Date(n).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromDay(toDay(d) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY);

// thứ Hai của tuần chứa ngày d
export function weekStartOf(d: string) {
  const dow = new Date(toDay(d)).getUTCDay(); // 0 = CN
  return addDays(d, -((dow + 6) % 7));
}

export const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const round = (n: number) => Math.round(n * 10) / 10;
const effort = (estimate: string | null) => EFFORT[estimate ?? ""] ?? EFFORT.M;

type Unit = {
  key: string;
  title: string;
  status: string;
  priority: string;
  estimate: string | null;
  sprint: string | null;
  assignee: string | null;
  parentKey: string | null;
  dependsOn: string[];
  createdOn: string;
  doneOn: string | null;
  lastActive: string;
};

export async function listGoals(projectId: number) {
  return db
    .select({
      id: goals.id,
      title: goals.title,
      measure: goals.measure,
      ownerId: goals.ownerId,
      owner: users.name,
      startOn: goals.startOn,
      dueOn: goals.dueOn,
      sprint: goals.sprint,
      taskKeys: goals.taskKeys,
      status: goals.status,
      updatedAt: goals.updatedAt,
    })
    .from(goals)
    .leftJoin(users, eq(users.id, goals.ownerId))
    .where(eq(goals.projectId, projectId))
    .orderBy(asc(goals.dueOn), asc(goals.position), asc(goals.id));
}

export type GoalRow = Awaited<ReturnType<typeof listGoals>>[number];

async function loadUnits(projectId: number) {
  const [rows, logs, decisions] = await Promise.all([
    db
      .select({
        key: tasks.key,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        estimate: tasks.estimate,
        sprint: tasks.sprint,
        assignee: users.name,
        parentKey: tasks.parentKey,
        dependsOn: tasks.dependsOn,
        createdOn: tasks.createdOn,
        updatedOn: tasks.updatedOn,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.seq)),
    db
      .select({ key: taskLogs.taskKey, date: taskLogs.date, text: taskLogs.text })
      .from(taskLogs)
      .innerJoin(tasks, eq(tasks.key, taskLogs.taskKey))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(taskLogs.id)),
    db
      .select({ key: records.key, data: records.data })
      .from(records)
      .where(and(eq(records.projectId, projectId), eq(records.kind, "decision"))),
  ]);

  const doneOn = new Map<string, string>();
  const lastLog = new Map<string, string>();
  for (const l of logs) {
    if (/→ (Xong|Released)/.test(l.text)) doneOn.set(l.key, l.date);
    if (l.date > (lastLog.get(l.key) ?? "")) lastLog.set(l.key, l.date);
  }
  const parents = new Set(rows.flatMap((r) => (r.parentKey ? [r.parentKey] : [])));
  const children = new Map<string, string[]>();
  for (const r of rows) if (r.parentKey) children.set(r.parentKey, [...(children.get(r.parentKey) ?? []), r.key]);

  // đơn vị công việc như trang Báo cáo: việc cha đã chia nhỏ chỉ là nhóm
  const units: Unit[] = rows
    .filter((r) => !parents.has(r.key))
    .map((r) => ({
      key: r.key,
      title: stripAreaTag(r.title),
      status: r.status,
      priority: r.priority,
      estimate: r.estimate,
      sprint: r.sprint,
      assignee: r.assignee,
      parentKey: r.parentKey,
      dependsOn: r.dependsOn,
      createdOn: r.createdOn,
      doneOn: isDone(r.status) ? (doneOn.get(r.key) ?? r.updatedOn) : null,
      lastActive: [lastLog.get(r.key) ?? "", r.updatedOn].sort().at(-1)!,
    }));

  // việc đang bị QD chưa trả lời chặn
  const blockedBy = new Map<string, string>();
  for (const d of decisions) {
    if (d.data.tra_loi) continue;
    for (const k of Array.isArray(d.data.chan_viec) ? (d.data.chan_viec as string[]) : []) blockedBy.set(k, d.key);
  }
  return { units, children, blockedBy };
}

export async function getWeekly(projectId: number, weekStart: string, opts: { allGoals?: boolean } = {}) {
  const ws = weekStartOf(weekStart);
  const we = addDays(ws, 6);
  const now = today();
  // xem tuần cũ thì mốc là cuối tuần đó; tuần này thì là hôm nay
  const ref = now < we ? now : we;
  const nextWs = addDays(ws, 7);

  const [{ units, children, blockedBy }, goalRows] = await Promise.all([loadUnits(projectId), listGoals(projectId)]);
  const byKey = new Map(units.map((u) => [u.key, u]));
  const live = units.filter((u) => u.status !== "huy");
  const inWeek = (d: string | null) => !!d && d >= ws && d <= we;

  // ---- sức làm: điểm cỡ việc xong mỗi tuần, trung bình 3 tuần trước tuần này ----
  const histFrom = addDays(ws, -21);
  const people = [...new Set(live.flatMap((u) => (u.assignee ? [u.assignee] : [])))].sort();
  const capacity = people.map((name) => {
    const mine = live.filter((u) => u.assignee === name);
    const hist = mine.filter((u) => u.doneOn && u.doneOn >= histFrom && u.doneOn < ws);
    const week = mine.filter((u) => inWeek(u.doneOn));
    const perWeek = hist.reduce((a, u) => a + effort(u.estimate), 0) / 3;
    return {
      name,
      perWeek: round(perWeek),
      thisWeek: round(week.reduce((a, u) => a + effort(u.estimate), 0)),
      // chưa có lịch sử thì lấy tuần này, tối thiểu một việc M
      plan: round(Math.max(perWeek || week.reduce((a, u) => a + effort(u.estimate), 0), MIN_CAPACITY)),
    };
  });

  // ---- mục tiêu ----
  const scopeOf = (g: GoalRow) => {
    const keys = new Set<string>();
    for (const k of g.taskKeys) for (const c of children.get(k) ?? [k]) keys.add(c);
    return live.filter((u) => (g.sprint && u.sprint === g.sprint) || keys.has(u.key));
  };
  const goalOf = new Map<string, number[]>();
  const goalReports = goalRows
    // báo cáo tuần: mục tiêu đang theo + mục tiêu vừa đóng trong tuần; trang Mục tiêu: tất cả
    .filter((g) => opts.allGoals || g.status === "dang-theo" || g.updatedAt.toISOString().slice(0, 10) >= ws)
    .map((g) => {
      const scope = scopeOf(g);
      for (const u of scope) goalOf.set(u.key, [...(goalOf.get(u.key) ?? []), g.id]);
      const total = scope.reduce((a, u) => a + effort(u.estimate), 0);
      const doneUnits = scope.filter((u) => u.doneOn && u.doneOn <= ref);
      const done = doneUnits.reduce((a, u) => a + effort(u.estimate), 0);
      const doneWeek = scope.filter((u) => inWeek(u.doneOn)).reduce((a, u) => a + effort(u.estimate), 0);
      const doneBefore = scope.filter((u) => u.doneOn && u.doneOn < ws).reduce((a, u) => a + effort(u.estimate), 0);
      const span = Math.max(daysBetween(g.startOn, g.dueOn), 1);
      const expected = Math.min(Math.max(daysBetween(g.startOn, ref) / span, 0), 1);
      const pct = total ? done / total : 0;
      // nhịp: điểm xong / tuần của mục tiêu trong 3 tuần gần nhất (gồm tuần này)
      const velocity = scope.filter((u) => u.doneOn && u.doneOn > addDays(ref, -21) && u.doneOn <= ref).reduce((a, u) => a + effort(u.estimate), 0) / 3;
      const remaining = total - done;
      const forecast = remaining <= 0 ? ref : velocity > 0 ? addDays(ref, Math.ceil((remaining / velocity) * 7)) : null;
      const onPace = pct >= expected - 0.1;
      // mục tiêu mới mở chưa đủ một tuần thì chưa có nhịp để dự báo – chỉ so với nhịp đều
      const young = daysBetween(g.startOn, ref) < 7;
      const pace: Pace = !scope.length
        ? "chua-co-viec"
        : remaining <= 0
          ? "du-dieu-kien"
          : ref > g.dueOn
            ? "qua-han"
            : !young && (!forecast || forecast > g.dueOn)
              ? "khong-kip"
              : onPace
                ? "dung-nhip"
                : "cham";
      return {
        ...g,
        total: round(total),
        done: round(done),
        doneWeek: round(doneWeek),
        pct: Math.round(pct * 100),
        pctBefore: total ? Math.round((doneBefore / total) * 100) : 0,
        expected: Math.round(expected * 100),
        velocity: round(velocity),
        forecast,
        daysLeft: daysBetween(ref, g.dueOn),
        pace,
        units: scope.length,
        unitsDone: doneUnits.length,
        blocked: scope.filter((u) => !u.doneOn && blockedBy.has(u.key)).map((u) => ({ key: u.key, by: blockedBy.get(u.key)! })),
      };
    });
  const goalTitle = new Map(goalReports.map((g) => [g.id, g.title]));
  const tag = (u: Unit) => ({
    key: u.key,
    title: u.title,
    status: u.status,
    priority: u.priority,
    estimate: u.estimate,
    assignee: u.assignee,
    goals: (goalOf.get(u.key) ?? []).map((id) => goalTitle.get(id)!),
  });

  // ---- tuần này ----
  const doneThisWeek = live.filter((u) => inWeek(u.doneOn)).sort((a, b) => a.doneOn!.localeCompare(b.doneOn!));
  const doing = live
    .filter((u) => DOING.includes(u.status))
    .map((u) => ({ ...tag(u), idleDays: daysBetween(u.lastActive, ref) }))
    .sort((a, b) => b.idleDays - a.idleDays);
  const added = live.filter((u) => u.createdOn >= ws && u.createdOn <= we);

  // ---- kế hoạch tuần tới: dồn việc theo thứ tự quan trọng vào sức làm từng người ----
  const urgency = (u: Unit) => {
    const gs = (goalOf.get(u.key) ?? []).map((id) => goalReports.find((g) => g.id === id)!).filter((g) => g.status === "dang-theo");
    const behind = gs.some((g) => ["cham", "khong-kip", "qua-han"].includes(g.pace));
    const due = gs.map((g) => g.dueOn).sort()[0] ?? "9999";
    return [
      DOING.includes(u.status) ? 0 : 1, // làm dở trước
      u.priority === "P0" ? 0 : 1,
      gs.length ? (behind ? 0 : 1) : 2, // việc của mục tiêu đang chậm, rồi mục tiêu đúng nhịp, rồi ngoài mục tiêu
      due,
      PRIORITY_WEIGHT[u.priority] ? -PRIORITY_WEIGHT[u.priority] : 0,
      u.key,
    ] as const;
  };
  const cmp = (a: Unit, b: Unit) => {
    const x = urgency(a);
    const y = urgency(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  };
  const blockedReason = (u: Unit) => {
    if (blockedBy.has(u.key)) return `chờ ${blockedBy.get(u.key)} được quyết`;
    const deps = u.dependsOn.filter((k) => byKey.get(k) && !byKey.get(k)!.doneOn && byKey.get(k)!.status !== "huy");
    return deps.length ? `chờ ${deps.join(", ")} xong` : null;
  };
  const open = live.filter((u) => OPEN.includes(u.status)).sort(cmp);
  const left = new Map(capacity.map((c) => [c.name, c.plan]));
  const plan: (ReturnType<typeof tag> & { cost: number })[] = [];
  const overflow: ReturnType<typeof tag>[] = [];
  const blocked: (ReturnType<typeof tag> & { reason: string })[] = [];
  const needOwner: ReturnType<typeof tag>[] = [];
  for (const u of open) {
    const reason = blockedReason(u);
    if (reason) {
      if (goalOf.has(u.key) || ["P0", "P1"].includes(u.priority)) blocked.push({ ...tag(u), reason });
      continue;
    }
    if (!u.assignee) {
      if (goalOf.has(u.key) || ["P0", "P1"].includes(u.priority)) needOwner.push(tag(u));
      continue;
    }
    const cost = effort(u.estimate) * (WAITING.includes(u.status) ? 0.5 : 1);
    const room = left.get(u.assignee) ?? MIN_CAPACITY;
    // việc đang làm dở luôn vào kế hoạch; việc mới chỉ nhận khi còn sức (cho vượt nhẹ một việc S)
    if (DOING.includes(u.status) || cost <= room + 0.5) {
      left.set(u.assignee, room - cost);
      plan.push({ ...tag(u), cost });
    } else if (goalOf.has(u.key) || ["P0", "P1"].includes(u.priority)) overflow.push(tag(u));
  }

  const report = await db
    .select({ body: weeklyReports.body, snapshot: weeklyReports.snapshot, author: users.name, updatedAt: weeklyReports.updatedAt })
    .from(weeklyReports)
    .leftJoin(users, eq(users.id, weeklyReports.authorId))
    .where(and(eq(weeklyReports.projectId, projectId), eq(weeklyReports.weekStart, ws)))
    .then((r) => r[0] ?? null);

  return {
    weekStart: ws,
    weekEnd: we,
    nextWeekStart: nextWs,
    asOf: ref,
    goals: goalReports,
    done: doneThisWeek.map((u) => ({ ...tag(u), doneOn: u.doneOn! })),
    donePoints: round(doneThisWeek.reduce((a, u) => a + effort(u.estimate), 0)),
    doing,
    added: added.length,
    capacity: capacity.map((c) => ({ ...c, planned: round(c.plan - (left.get(c.name) ?? c.plan)) })),
    teamPerWeek: round(capacity.reduce((a, c) => a + c.perWeek, 0)),
    plan,
    overflow,
    blocked,
    needOwner,
    report,
  };
}

export type Weekly = Awaited<ReturnType<typeof getWeekly>>;

export async function listWeeklyReports(projectId: number) {
  return db
    .select({ weekStart: weeklyReports.weekStart, updatedAt: weeklyReports.updatedAt })
    .from(weeklyReports)
    .where(eq(weeklyReports.projectId, projectId))
    .orderBy(desc(weeklyReports.weekStart));
}

// số liệu giữ cùng bản báo cáo – xem lại tuần cũ vẫn thấy đúng con số lúc viết
export function snapshotOf(w: Weekly) {
  return {
    luc: w.asOf,
    muc_tieu: w.goals.map((g) => ({ id: g.id, tieu_de: g.title, tien_do: g.pct, ky_vong: g.expected, danh_gia: g.pace, han: g.dueOn })),
    xong: w.done.length,
    diem_xong: w.donePoints,
    dang_lam: w.doing.length,
  };
}

export async function upsertWeekly(projectId: number, week: string, body: string, authorId: number) {
  const ws = weekStartOf(week);
  const snapshot = snapshotOf(await getWeekly(projectId, ws));
  await db
    .insert(weeklyReports)
    .values({ projectId, weekStart: ws, body, snapshot, authorId })
    .onConflictDoUpdate({
      target: [weeklyReports.projectId, weeklyReports.weekStart],
      set: { body, snapshot, authorId, updatedAt: new Date() },
    });
  return ws;
}

// ---- Dạng API: tên trường tiếng Việt như phần còn lại của /api/v1 ----

export function goalApi(g: Weekly["goals"][number]) {
  return {
    id: g.id,
    tieu_de: g.title,
    dat_khi: g.measure,
    nguoi_chiu_trach_nhiem: g.owner,
    bat_dau: g.startOn,
    han: g.dueOn,
    dot: g.sprint,
    viec: g.taskKeys,
    trang_thai: g.status,
    tien_do: g.pct,
    tien_do_tuan_truoc: g.pctBefore,
    nhip_deu_can: g.expected,
    danh_gia: g.pace,
    danh_gia_chu: PACE[g.pace].label,
    diem: { tong: g.total, xong: g.done, xong_tuan_nay: g.doneWeek, moi_tuan: g.velocity },
    du_kien_xong: g.forecast,
    con_ngay: g.daysLeft,
    so_viec: g.units,
    so_viec_xong: g.unitsDone,
    bi_chan: g.blocked.map((b) => ({ viec: b.key, boi: b.by })),
  };
}

export function weeklyApi(w: Weekly, projectCode: string) {
  const t = (x: { key: string; title: string; status: string; priority: string; estimate: string | null; assignee: string | null; goals: string[] }) => ({
    id: x.key,
    tieu_de: x.title,
    trang_thai: x.status,
    uu_tien: x.priority,
    uoc_luong: x.estimate,
    nguoi_lam: x.assignee,
    muc_tieu: x.goals,
  });
  return {
    du_an: projectCode,
    tuan: w.weekStart,
    den_ngay: w.weekEnd,
    tinh_den: w.asOf,
    tuan_toi: w.nextWeekStart,
    cach_tinh:
      "Điểm = cỡ việc (S 1, M 2, L 4; chưa ước lượng tính M). Tiến độ mục tiêu = điểm việc xong / tổng điểm phạm vi (đợt gắn kèm + việc liệt kê). nhip_deu_can = % lẽ ra phải đạt nếu đi đều từ ngày bắt đầu tới hạn. Sức làm = điểm xong trung bình mỗi tuần trong 3 tuần trước, tối thiểu 2.",
    muc_tieu: w.goals.map(goalApi),
    xong_trong_tuan: w.done.map((x) => ({ ...t(x), ngay_xong: x.doneOn })),
    diem_xong_trong_tuan: w.donePoints,
    suc_lam_doi_moi_tuan: w.teamPerWeek,
    viec_moi_trong_tuan: w.added,
    dang_lam: w.doing.map((x) => ({ ...t(x), so_ngay_dung_yen: x.idleDays })),
    suc_lam: w.capacity.map((c) => ({ nguoi: c.name, moi_tuan: c.perWeek, tuan_nay: c.thisWeek, tuan_toi_nhan: c.plan, da_xep: c.planned })),
    ke_hoach_tuan_toi: w.plan.map((x) => ({ ...t(x), diem: x.cost })),
    khong_vua_suc: w.overflow.map(t),
    can_nguoi_nhan: w.needOwner.map(t),
    bi_chan: w.blocked.map((x) => ({ ...t(x), ly_do: x.reason })),
    ban_nhap: draftBody(w),
    bao_cao: w.report ? { noi_dung: w.report.body, nguoi_viet: w.report.author, luc: w.report.updatedAt } : null,
  };
}

// ---- Bản nháp Markdown từ số liệu – Claude dùng làm khung rồi viết lại cho gọn, có nhận định ----

export function draftBody(w: Weekly) {
  const L: string[] = [];
  const who = (x: { assignee: string | null }) => (x.assignee ? ` – ${x.assignee}` : "");
  const active = w.goals.filter((g) => g.status === "dang-theo");
  L.push("## Mục tiêu");
  if (!w.goals.length) L.push("Chưa đặt mục tiêu nào – vào trang **Mục tiêu** để đặt.");
  for (const g of w.goals) {
    const state = g.status === "dang-theo" ? PACE[g.pace].label : GOAL_STATUSES.find((s) => s.value === g.status)!.label;
    L.push(
      `- **${g.title}** (hạn ${fmtDay(g.dueOn)}): ${g.pct}% (tuần trước ${g.pctBefore}%, nhịp đều cần ${g.expected}%) – ${state}` +
        (g.forecast && g.pace !== "du-dieu-kien" ? `; giữ nhịp này thì xong khoảng ${fmtDay(g.forecast)}` : "") +
        (g.blocked.length ? `; vướng ${g.blocked.map((b) => `${b.key} (${b.by})`).join(", ")}` : ""),
    );
  }
  L.push("", "## Đạt được trong tuần");
  L.push(w.done.length ? `${w.done.length} việc, ${w.donePoints} điểm${w.teamPerWeek ? ` (đội thường làm ${w.teamPerWeek} điểm / tuần)` : " (chưa đủ 3 tuần lịch sử để so – sức làm tuần tới tạm lấy theo tuần này)"}.` : "Chưa có việc nào xong trong tuần.");
  for (const t of w.done) L.push(`- ${t.key} ${t.title}${who(t)}${t.goals.length ? ` → ${t.goals.join(", ")}` : ""}`);
  L.push("", "## Đang làm");
  if (!w.doing.length) L.push("Không có việc nào đang làm.");
  for (const t of w.doing) {
    L.push(`- ${t.key} ${t.title}${who(t)}${t.idleDays >= STALE_DAYS ? ` – **đứng yên ${t.idleDays} ngày**` : ""}`);
  }
  L.push("", `## Kế hoạch tuần ${fmtDay(w.nextWeekStart)}–${fmtDay(addDays(w.nextWeekStart, 6))}`);
  for (const c of w.capacity.filter((c) => w.plan.some((p) => p.assignee === c.name))) {
    const items = w.plan.filter((p) => p.assignee === c.name);
    L.push(`- **${c.name}** (${c.planned}/${c.plan} điểm): ${items.map((p) => `${p.key} ${p.title}`).join("; ")}`);
  }
  if (w.needOwner.length) L.push(`- Cần người nhận: ${w.needOwner.map((t) => `${t.key} ${t.title}`).join("; ")}`);
  if (w.overflow.length) L.push(`- Không vừa sức tuần tới (để sau hoặc thêm người): ${w.overflow.map((t) => t.key).join(", ")}`);
  if (w.blocked.length) L.push(`- Đang bị chặn: ${w.blocked.map((t) => `${t.key} (${t.reason})`).join("; ")}`);
  const risky = active.filter((g) => ["khong-kip", "qua-han"].includes(g.pace));
  if (risky.length) {
    L.push("", "## Cần quyết");
    for (const g of risky) L.push(`- **${g.title}**: ${PACE[g.pace].label.toLowerCase()} – lùi hạn, thu hẹp phạm vi hay thêm người?`);
  }
  return L.join("\n");
}
