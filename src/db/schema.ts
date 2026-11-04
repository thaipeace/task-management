import {
  boolean,
  doublePrecision,
  index,
  integer,
  json,
  jsonb,
  pgTable,
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

// "dot" trong backlog.json
export const sprints = pgTable("sprints", {
  code: text("code").primaryKey(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
});

// "dem_id" trong backlog.json
export const counters = pgTable("counters", {
  prefix: text("prefix").primaryKey(),
  next: integer("next").notNull().default(1),
});

// "viec" trong backlog.json
export const tasks = pgTable(
  "tasks",
  {
    key: text("key").primaryKey(),
    // thứ tự trong tệp backlog.json (việc mới nối cuối) – dùng khi export
    seq: serial("seq"),
    title: text("title").notNull(),
    area: text("area").notNull(),
    type: text("type").notNull(),
    sprint: text("sprint").references(() => sprints.code, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priority: text("priority").notNull().default("P2"),
    status: text("status").notNull().default("moi"),
    estimate: text("estimate"),
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
    index("tasks_status_idx").on(t.status),
    index("tasks_sprint_idx").on(t.sprint),
    uniqueIndex("tasks_external_key_idx").on(t.externalKey),
    index("tasks_parent_idx").on(t.parentKey),
  ],
);

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
  kind: text("kind", { enum: ["risk", "decision"] }).notNull(),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// _huong_dan, phien_ban_cau_truc, goc_ma, ghi_chu_ngoai_pham_vi
export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: json("value"),
});

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type TaskRecord = typeof records.$inferSelect;
