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

export const db: DB = globalForDb.__db ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
