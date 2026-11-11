import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export type Approval = { ai: string; ly_do: string } | null;
export type Related = {
  issue: string | number | null;
  pr: string | number | null;
  viec: string[];
  tai_lieu: string[];
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // sha256 của token trong cookie – không lưu token gốc
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// Dự án: mỗi dự án là một backlog riêng (đợt, việc, AR/QD, meta), import / export riêng
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  // mã ngắn, viết hoa (SIA) – không đổi sau khi tạo vì nằm trong id việc
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // đứng trước id việc: "" cho SIA (giữ BE-001 như backlog.json cũ), "ABC-" cho dự án mới → ABC-BE-001
  keyPrefix: text("key_prefix").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const projectRef = () =>
  integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" });

// "dot" trong backlog.json – mã đợt chỉ cần riêng trong một dự án
export const sprints = pgTable(
  "sprints",
  {
    projectId: projectRef(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.code] })],
);

// "dem_id" trong backlog.json – tiền tố đã gồm keyPrefix của dự án nên vẫn là khoá chung
export const counters = pgTable("counters", {
  prefix: text("prefix").primaryKey(),
  projectId: projectRef(),
  next: integer("next").notNull().default(1),
});

// "viec" trong backlog.json
export const tasks = pgTable(
  "tasks",
  {
    key: text("key").primaryKey(),
    projectId: projectRef(),
    // thứ tự trong tệp backlog.json (việc mới nối cuối) – dùng khi export
    seq: serial("seq"),
    title: text("title").notNull(),
    area: text("area").notNull(),
    type: text("type").notNull(),
    // khoá ngoại (project_id, sprint) ở dưới; xoá đợt thì action tự đưa việc về "chưa xếp đợt"
    sprint: text("sprint"),
    priority: text("priority").notNull().default("P2"),
    status: text("status").notNull().default("moi"),
    estimate: text("estimate"),
    // bản release đầu tiên có việc này (vd. 2.45.8-rc1), gắn khi tạo nhánh release
    releasedVersion: text("released_version"),
    description: text("description").notNull().default(""),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    steps: jsonb("steps").$type<string[]>().notNull().default([]),
    doneCriteria: jsonb("done_criteria").$type<string[]>().notNull().default([]),
    tests: jsonb("tests").$type<string[]>().notNull().default([]),
    risk: text("risk").notNull().default(""),
    approval: jsonb("approval").$type<Approval>(),
    dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
    related: jsonb("related")
      .$type<Related>()
      .notNull()
      .default({ issue: null, pr: null, viec: [], tai_lieu: [] }),
    branch: text("branch"),
    source: text("source").notNull().default(""),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    // "khoa_ngoai": khoá do công cụ ngoài đặt (vd. tên bài test lỗi) để gọi API nhiều lần không tạo trùng
    externalKey: text("external_key"),
    // việc con: chỉ một cấp (việc cha không được là việc con) – kiểm tra trong task-service
    parentKey: text("parent_key").references((): AnyPgColumn => tasks.key, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // thứ tự trong danh sách việc con của việc cha (kéo thả)
    subOrder: doublePrecision("sub_order").notNull().default(0),
    position: doublePrecision("position").notNull().default(0),
    createdOn: text("created_on").notNull(),
    updatedOn: text("updated_on").notNull(),
    // các trường lạ trong tệp import – giữ lại để export ra đủ (json, không jsonb: giữ thứ tự khoá)
    extra: json("extra").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "tasks_sprint_fk",
      columns: [t.projectId, t.sprint],
      foreignColumns: [sprints.projectId, sprints.code],
    }).onUpdate("cascade"),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_status_idx").on(t.status),
    index("tasks_sprint_idx").on(t.sprint),
    uniqueIndex("tasks_external_key_idx").on(t.externalKey),
    index("tasks_parent_idx").on(t.parentKey),
  ],
);

// Id cũ của việc đã đổi id (vd. BE-010 → SIA-010) – mở / gọi API bằng id cũ vẫn tới đúng việc
export const taskAliases = pgTable("task_aliases", {
  oldKey: text("old_key").primaryKey(),
  newKey: text("new_key")
    .notNull()
    .references(() => tasks.key, { onDelete: "cascade", onUpdate: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// "nhat_ky" của từng việc
export const taskLogs = pgTable(
  "task_logs",
  {
    id: serial("id").primaryKey(),
    taskKey: text("task_key")
      .notNull()
      .references(() => tasks.key, { onDelete: "cascade", onUpdate: "cascade" }),
    date: text("date").notNull(),
    text: text("text").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_logs_task_idx").on(t.taskKey)],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    taskKey: text("task_key")
      .notNull()
      .references(() => tasks.key, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_task_idx").on(t.taskKey)],
);

// "chap_nhan_rui_ro" (kind = risk) và "cho_quyet_dinh" (kind = decision)
// Token cá nhân để gọi /api/v1 – chỉ lưu sha256, token gốc hiện một lần lúc tạo
export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  // vài ký tự đầu để nhận ra token trong danh sách
  prefix: text("prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const records = pgTable("records", {
  key: text("key").primaryKey(),
  projectId: projectRef(),
  kind: text("kind", { enum: ["risk", "decision"] }).notNull(),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// _huong_dan, phien_ban_cau_truc, goc_ma, ghi_chu_ngoai_pham_vi
export const meta = pgTable(
  "meta",
  {
    projectId: projectRef(),
    key: text("key").notNull(),
    value: json("value"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.key] })],
);

// Mục tiêu: kết quả cần đạt trước một hạn. Phạm vi = việc trong đợt gắn kèm và / hoặc các việc liệt kê –
// tiến độ tính từ phạm vi đó nên không phải tự khai. Báo cáo tuần lấy mục tiêu làm chuẩn.
export const goals = pgTable(
  "goals",
  {
    id: serial("id").primaryKey(),
    projectId: projectRef(),
    title: text("title").notNull(),
    // "Đạt khi": điều kiện kiểm chứng được (Markdown)
    measure: text("measure").notNull().default(""),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    startOn: text("start_on").notNull(),
    dueOn: text("due_on").notNull(),
    sprint: text("sprint"),
    taskKeys: jsonb("task_keys").$type<string[]>().notNull().default([]),
    // dang-theo | dat | khong-dat | bo – đóng mục tiêu là việc của người, không tự đổi
    status: text("status").notNull().default("dang-theo"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "goals_sprint_fk",
      columns: [t.projectId, t.sprint],
      foreignColumns: [sprints.projectId, sprints.code],
    }).onUpdate("cascade"),
    index("goals_project_idx").on(t.projectId),
  ],
);

// Báo cáo tuần: mỗi dự án một bản / tuần (tuần bắt đầu thứ Hai). Lời văn do Claude (hoặc người) viết,
// snapshot giữ số liệu lúc viết để xem lại tuần cũ không bị số mới đè.
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: serial("id").primaryKey(),
    projectId: projectRef(),
    weekStart: text("week_start").notNull(),
    body: text("body").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_reports_week_idx").on(t.projectId, t.weekStart)],
);

export const devReleases = pgTable(
  "dev_releases",
  {
    id: serial("id").primaryKey(),
    projectId: projectRef(),
    mainVersion: text("main_version").notNull(),
    rc: integer("rc").notNull(),
    // phần 1 – nhận xét chung (business, tính năng nổi bật)
    body: text("body").notNull(),
    // phần 3 – ghi chú thêm (kỹ thuật, việc cần làm khi triển khai, quay lại…)
    notes: text("notes").notNull().default(""),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("dev_releases_version_idx").on(t.projectId, t.mainVersion, t.rc)],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type TaskRecord = typeof records.$inferSelect;
export type Goal = typeof goals.$inferSelect;
