import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, createTaskSchema, json, parseBody, readJson, toTaskData, withApiAuth } from "@/lib/api";
import { getApiTask, listApiTasks } from "@/lib/api-tasks";
import { createTaskCore, type TaskData } from "@/lib/task-service";

export const GET = withApiAuth(async (req, me) => {
  const sp = new URL(req.url).searchParams;
  const limit = Number(sp.get("gioi_han") ?? 200);
  const viec = await listApiTasks(
    {
      trang_thai: sp.get("trang_thai")?.split(",").filter(Boolean),
      dot: sp.get("dot") ?? undefined,
      mang: sp.get("mang") ?? undefined,
      uu_tien: sp.get("uu_tien") ?? undefined,
      loai: sp.get("loai") ?? undefined,
      nguoi_lam: sp.get("nguoi_lam") ?? undefined,
      q: sp.get("q") ?? undefined,
      khoa_ngoai: sp.get("khoa_ngoai") ?? undefined,
      gioi_han: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 200,
    },
    me.id,
  );
  return json({ so_luong: viec.length, viec });
});

// Tạo việc. Có "khoa_ngoai" mà đã có việc mang khoá đó → trả việc cũ (200, tao_moi: false), không tạo trùng.
export const POST = withApiAuth(async (req, me) => {
  const input = parseBody(createTaskSchema, await readJson(req));
  const data = await toTaskData(input);

  const existingKey = async () => {
    if (!input.khoa_ngoai) return null;
    const [t] = await db
      .select({ key: tasks.key })
      .from(tasks)
      .where(eq(tasks.externalKey, input.khoa_ngoai));
    return t?.key ?? null;
  };
  const found = await existingKey();
  if (found) return json({ tao_moi: false, viec: await getApiTask(found) });

  const full: TaskData = {
    type: "loi",
    priority: "P2",
    status: "moi",
    ...data,
    title: input.tieu_de,
    area: input.mang,
  };
  try {
    const key = await createTaskCore(full, me, " qua API");
    return json({ tao_moi: true, viec: await getApiTask(key) }, 201);
  } catch (e) {
    // hai lệnh cùng khoa_ngoai chạy song song: lệnh thua trả việc của lệnh thắng
    const again = await existingKey();
    if (again) return json({ tao_moi: false, viec: await getApiTask(again) });
    throw e instanceof ApiError ? e : e;
  }
});
