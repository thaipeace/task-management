import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

function connect(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu biến môi trường DATABASE_URL");
  // Theo khuyến nghị của Neon cho Vercel: node-postgres + Fluid compute.
  // DATABASE_URL là chuỗi pooled (-pooler); attachDatabasePool đóng kết nối rảnh trước khi function bị treo.
  const pool = new Pool({ connectionString: url, max: 5 });
  attachDatabasePool(pool);
  return drizzle({ client: pool, schema });
}

const globalForDb = globalThis as unknown as { __db?: DB };

function instance(): DB {
  globalForDb.__db ??= connect();
  return globalForDb.__db;
}

// Kết nối ở lần truy vấn đầu tiên, không phải lúc import – để `next build` chạy được khi chưa có DATABASE_URL
export const db = new Proxy({} as DB, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
