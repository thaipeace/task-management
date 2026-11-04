import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { apiTokens, sprints, users } from "@/db/schema";
import { hashToken, newToken, type CurrentUser } from "./auth";
import { AREAS, ESTIMATES, PRIORITIES, STATUSES, TYPES } from "./constants";
import { TaskRuleError, type TaskData } from "./task-service";

export const TOKEN_PREFIX = "tm_";

export function generateApiToken() {
  const token = TOKEN_PREFIX + newToken();
  return { token, hash: hashToken(token), prefix: token.slice(0, 10) };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// Bọc route handler: xác thực Bearer token, đổi ApiError thành JSON lỗi
export function withApiAuth<C>(
  handler: (req: Request, me: CurrentUser, ctx: C) => Promise<Response>,
) {
  return async (req: Request, ctx: C) => {
    try {
      const me = await authenticate(req);
      return await handler(req, me, ctx);
    } catch (e) {
      // tín hiệu nội bộ của Next (vd. dừng prerender khi đọc header) phải được ném tiếp
      unstable_rethrow(e);
      if (e instanceof TaskRuleError) return json({ loi: e.message }, 400);
      if (e instanceof ApiError) {
        return json({ loi: e.message, ...(e.details ? { chi_tiet: e.details } : {}) }, e.status);
      }
      console.error(e);
      return json({ loi: "Lỗi máy chủ" }, 500);
    }
  };
}

async function authenticate(req: Request): Promise<CurrentUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token?.startsWith(TOKEN_PREFIX)) {
    throw new ApiError(401, "Thiếu token: gửi header 'Authorization: Bearer tm_…'");
  }
  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(users.active, true)))
    .limit(1);
  if (!row) throw new ApiError(401, "Token không hợp lệ, đã bị thu hồi hoặc tài khoản đã bị khoá");

  // ghi lần dùng gần nhất, tối đa mỗi phút một lần
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(
      and(
        eq(apiTokens.id, row.tokenId),
        or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, sql`now() - interval '1 minute'`)),
      ),
    );
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Body phải là JSON hợp lệ");
  }
}

// ---- Dữ liệu việc theo tên trường của backlog.json ----

const enumOf = <T extends readonly { value: string }[]>(list: T) =>
  z.enum(list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]]);

const strList = z.array(z.string());
const ref = z.union([z.string(), z.number()]).nullable();

const taskFields = {
  tieu_de: z.string().trim().min(1),
  mang: enumOf(AREAS),
  loai: enumOf(TYPES),
  dot: z.string().nullable(),
  uu_tien: enumOf(PRIORITIES),
  trang_thai: enumOf(STATUSES),
  uoc_luong: enumOf(ESTIMATES).nullable(),
  mo_ta: z.string(),
  bang_chung: strList,
  viec_can_lam: strList,
  tieu_chi_xong: strList,
  kiem_thu: strList,
  rui_ro: z.string(),
  can_phe_duyet: z.object({ ai: z.string(), ly_do: z.string() }).nullable(),
  phu_thuoc: strList,
  lien_quan: z.object({
    issue: ref.default(null),
    pr: ref.default(null),
    viec: strList.default([]),
    tai_lieu: strList.default([]),
  }),
  nhanh_goi_y: z.string().nullable(),
  nguon: z.string(),
  nguoi_lam: z.string().email().nullable(),
  khoa_ngoai: z.string().trim().min(1).max(500).nullable(),
  // id việc cha (việc con chỉ một cấp); null = tách khỏi việc cha
  viec_cha: z.string().trim().min(1).nullable(),
};

export const createTaskSchema = z
  .object(taskFields)
  .partial()
  .required({ tieu_de: true, mang: true })
  .strict();

export const patchTaskSchema = z.object(taskFields).partial().strict();

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "Dữ liệu không hợp lệ",
      parsed.error.issues.map((i) => ({ truong: i.path.join("."), loi: i.message })),
    );
  }
  return parsed.data;
}

type TaskInput = z.infer<typeof patchTaskSchema>;

// Đổi tên trường API → cột DB; kiểm tra email người làm và mã đợt có thật
export async function toTaskData(input: TaskInput): Promise<Partial<TaskData>> {
  const out: Partial<TaskData> = {};
  const map: [keyof TaskInput, keyof TaskData][] = [
    ["tieu_de", "title"],
    ["mang", "area"],
    ["loai", "type"],
    ["dot", "sprint"],
    ["uu_tien", "priority"],
    ["trang_thai", "status"],
    ["uoc_luong", "estimate"],
    ["mo_ta", "description"],
    ["bang_chung", "evidence"],
    ["viec_can_lam", "steps"],
    ["tieu_chi_xong", "doneCriteria"],
    ["kiem_thu", "tests"],
    ["rui_ro", "risk"],
    ["can_phe_duyet", "approval"],
    ["phu_thuoc", "dependsOn"],
    ["lien_quan", "related"],
    ["nhanh_goi_y", "branch"],
    ["nguon", "source"],
    ["khoa_ngoai", "externalKey"],
  ];
  if (input.viec_cha !== undefined) out.parentKey = input.viec_cha?.toUpperCase() ?? null;
  for (const [from, to] of map) {
    if (input[from] !== undefined) (out as Record<string, unknown>)[to] = input[from];
  }

  if (input.dot) {
    const [s] = await db.select({ code: sprints.code }).from(sprints).where(eq(sprints.code, input.dot));
    if (!s) throw new ApiError(400, `Không có đợt '${input.dot}' – xem GET /api/v1/sprints`);
  }
  if (input.nguoi_lam !== undefined) {
    if (input.nguoi_lam === null) out.assigneeId = null;
    else {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.nguoi_lam.toLowerCase()), eq(users.active, true)));
      if (!u) throw new ApiError(400, `Không có người dùng '${input.nguoi_lam}'`);
      out.assigneeId = u.id;
    }
  }
  return out;
}

export async function assigneeEmails(ids: (number | null)[]) {
  const wanted = [...new Set(ids.filter((x): x is number => x != null))];
  if (!wanted.length) return new Map<number, string>();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, wanted));
  return new Map(rows.map((r) => [r.id, r.email]));
}
