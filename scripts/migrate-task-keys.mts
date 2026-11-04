// Đổi id việc sang chuẩn dự án: BE-010 / FE-010 … → SIA-010 / SIA-010a …, mảng chuyển vào tiêu đề "[FE] …".
//
//   set -a && . ./.env.prod && set +a
//   npx tsx scripts/migrate-task-keys.mts            # chạy thử: in bảng đổi id rồi ROLLBACK, không đổi gì
//   npx tsx scripts/migrate-task-keys.mts --apply    # đổi thật (một transaction)
//
// - Id trùng số: việc sửa sớm nhất (updated_at) giữ số trơn, việc sửa sau thêm a, b, c…
// - Nhật ký, bình luận, việc con đi theo id mới (khoá ngoại ON UPDATE CASCADE).
// - Id cũ nằm trong văn bản (mô tả, nhật ký, bình luận, AR/QD, ghi chú…) được thay bằng id mới.
// - Id cũ được lưu ở task_aliases: mở /tasks/BE-010 hay gọi API bằng id cũ vẫn tới đúng việc.
// - Chạy lại lần nữa không đổi gì thêm (id đã đúng chuẩn thì giữ nguyên).
import pg from "pg";
import { AREAS } from "../src/lib/constants";
import { formatTaskKey, suffixAt, taskKeyPattern, withAreaTag } from "../src/lib/task-keys";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Thiếu DATABASE_URL");

// văn bản hướng dẫn / cấu hình của tệp backlog – không phải nơi nhắc tới việc cụ thể
const META_SKIP = ["_huong_dan", "phien_ban_cau_truc", "goc_ma", "__thu_tu_khoa"];

const client = new pg.Client({ connectionString: url });
await client.connect();
const q = <T extends pg.QueryResultRow>(text: string, params?: unknown[]) =>
  client.query<T>(text, params).then((r) => r.rows);

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

try {
  await q("begin");

  // ---- 1. bảng đổi id cho từng dự án ----
  const projects = await q<{ id: number; code: string; key_prefix: string }>(
    "select id, code, key_prefix from projects order by id",
  );
  const rename = new Map<string, string>(); // id cũ → id mới
  const counters: { projectId: number; code: string; keyPrefix: string; next: number }[] = [];

  for (const p of projects) {
    const rows = await q<{ key: string; updated_at: Date; seq: number }>(
      "select key, updated_at, seq from tasks where project_id = $1 order by updated_at, seq",
      [p.id],
    );
    const pattern = taskKeyPattern(p.code);
    const taken = new Set(rows.filter((r) => pattern.test(r.key)).map((r) => r.key));
    const numbers = [...taken].map((k) => Number(pattern.exec(k)![1]));
    const todo = rows.filter((r) => !pattern.test(r.key));
    for (const r of todo) {
      const n = /(\d+)$/.exec(r.key)?.[1];
      if (n) numbers.push(Number(n));
    }
    let next = Math.max(0, ...numbers) + 1;
    for (const r of todo) {
      const m = /(\d+)$/.exec(r.key);
      const n = m ? Number(m[1]) : next++;
      let key = formatTaskKey(p.code, n);
      for (let i = 0; taken.has(key); i++) key = formatTaskKey(p.code, n, suffixAt(i));
      taken.add(key);
      rename.set(r.key, key);
    }
    counters.push({ projectId: p.id, code: p.code, keyPrefix: p.key_prefix, next });
  }

  // ---- 2. đổi id (nhật ký, bình luận, việc con theo cascade) + lưu id cũ ----
  for (const [oldKey, newKey] of rename) {
    await q("update tasks set key = $2 where key = $1", [oldKey, newKey]);
    await q("insert into task_aliases (old_key, new_key) values ($1, $2) on conflict (old_key) do update set new_key = excluded.new_key", [oldKey, newKey]);
  }

  // ---- 3. thay id cũ trong văn bản ----
  const olds = [...rename.keys()].sort((a, b) => b.length - a.length);
  const re = olds.length
    ? new RegExp(`(?<![A-Za-z0-9-])(${olds.map((k) => k.replace(/[-]/g, "\\-")).join("|")})(?![A-Za-z0-9])`, "g")
    : null;
  const rewrite = (s: string) => (re ? s.replace(re, (k) => rename.get(k)!) : s);
  const rewriteJson = <T,>(v: T): T => (v == null ? v : JSON.parse(rewrite(JSON.stringify(v))));
  const changed = { tasks: 0, titles: 0, logs: 0, comments: 0, records: 0, meta: 0 };

  type TaskRow = {
    key: string; area: string; title: string; description: string; risk: string; source: string;
    evidence: string[]; steps: string[]; done_criteria: string[]; tests: string[]; depends_on: string[];
    related: unknown; approval: unknown; extra: unknown;
  };
  const tasks = await q<TaskRow>(
    "select key, area, title, description, risk, source, evidence, steps, done_criteria, tests, depends_on, related, approval, extra from tasks",
  );
  for (const t of tasks) {
    const title = withAreaTag(rewrite(t.title), t.area);
    const next = {
      description: rewrite(t.description),
      risk: rewrite(t.risk),
      source: rewrite(t.source),
      evidence: rewriteJson(t.evidence),
      steps: rewriteJson(t.steps),
      done_criteria: rewriteJson(t.done_criteria),
      tests: rewriteJson(t.tests),
      depends_on: rewriteJson(t.depends_on),
      related: rewriteJson(t.related),
      approval: rewriteJson(t.approval),
      extra: rewriteJson(t.extra),
    };
    const textChanged = (Object.keys(next) as (keyof typeof next)[]).some(
      (k) => JSON.stringify(next[k]) !== JSON.stringify(t[k]),
    );
    if (title !== t.title) changed.titles++;
    if (textChanged) changed.tasks++;
    if (title === t.title && !textChanged) continue;
    await q(
      `update tasks set title = $2, description = $3, risk = $4, source = $5, evidence = $6::jsonb, steps = $7::jsonb,
         done_criteria = $8::jsonb, tests = $9::jsonb, depends_on = $10::jsonb, related = $11::jsonb,
         approval = $12::jsonb, extra = $13::json where key = $1`,
      [
        t.key, title, next.description, next.risk, next.source,
        JSON.stringify(next.evidence), JSON.stringify(next.steps), JSON.stringify(next.done_criteria),
        JSON.stringify(next.tests), JSON.stringify(next.depends_on), JSON.stringify(next.related),
        JSON.stringify(next.approval), JSON.stringify(next.extra),
      ],
    );
  }

  for (const l of await q<{ id: number; text: string }>("select id, text from task_logs")) {
    const text = rewrite(l.text);
    if (text !== l.text) {
      await q("update task_logs set text = $2 where id = $1", [l.id, text]);
      changed.logs++;
    }
  }
  for (const c of await q<{ id: number; body: string }>("select id, body from comments")) {
    const body = rewrite(c.body);
    if (body !== c.body) {
      await q("update comments set body = $2 where id = $1", [c.id, body]);
      changed.comments++;
    }
  }
  for (const r of await q<{ key: string; data: unknown }>("select key, data from records")) {
    const data = rewriteJson(r.data);
    if (JSON.stringify(data) !== JSON.stringify(r.data)) {
      await q("update records set data = $2::json where key = $1", [r.key, JSON.stringify(data)]);
      changed.records++;
    }
  }
  for (const m of await q<{ project_id: number; key: string; value: unknown }>("select project_id, key, value from meta")) {
    if (META_SKIP.includes(m.key)) continue;
    const value = rewriteJson(m.value);
    if (JSON.stringify(value) !== JSON.stringify(m.value)) {
      await q("update meta set value = $3::json where project_id = $1 and key = $2", [m.project_id, m.key, JSON.stringify(value)]);
      changed.meta++;
    }
  }

  // ---- 4. nhật ký đổi id (ghi sau bước 3 để giữ id cũ trong dòng này) ----
  for (const [oldKey, newKey] of rename) {
    await q("insert into task_logs (task_key, date, text) values ($1, $2, $3)", [
      newKey, today, `Đổi id: ${oldKey} → ${newKey} (chuẩn id theo dự án, mảng chuyển vào tiêu đề)`,
    ]);
  }

  // ---- 5. bộ đếm: một bộ đếm id việc cho mỗi dự án, bỏ bộ đếm theo mảng (giữ AR / QD) ----
  for (const c of counters) {
    await q(
      `insert into counters (prefix, project_id, next) values ($1, $2, $3)
       on conflict (prefix) do update set next = greatest(counters.next, excluded.next)`,
      [c.code, c.projectId, c.next],
    );
    await q("delete from counters where project_id = $1 and prefix = any($2)", [
      c.projectId, AREAS.map((a) => c.keyPrefix + a.value),
    ]);
  }

  // ---- báo cáo ----
  const byNew = [...rename].sort((a, b) => a[1].localeCompare(b[1]));
  for (const [o, n] of byNew) console.log(`${o.padEnd(10)} → ${n}`);
  console.log(`\n${rename.size} việc đổi id; tiêu đề thêm [mảng]: ${changed.titles}; văn bản thay id cũ: việc ${changed.tasks}, nhật ký ${changed.logs}, bình luận ${changed.comments}, AR/QD ${changed.records}, meta ${changed.meta}`);
  console.log("bộ đếm:", counters.map((c) => `${c.code} → ${formatTaskKey(c.code, c.next)}`).join(", "));
  const sample = await q<{ key: string; title: string }>("select key, title from tasks order by key limit 3");
  console.log("ví dụ:", sample.map((t) => `${t.key} ${t.title.slice(0, 50)}`).join(" | "));

  if (apply) {
    await q("commit");
    console.log("\nĐÃ ÁP DỤNG.");
  } else {
    await q("rollback");
    console.log("\nChạy thử – đã ROLLBACK, chưa đổi gì. Thêm --apply để đổi thật.");
  }
} catch (e) {
  await q("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
