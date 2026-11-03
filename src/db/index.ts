import "server-only";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

function connect(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu biến môi trường DATABASE_URL");
  // Neon: driver serverless (WebSocket) chạy tốt trên Vercel và hỗ trợ transaction.
  // Postgres khác (local): node-postgres.
  if (new URL(url).hostname.endsWith(".neon.tech")) {
    return drizzleNeon({ client: new NeonPool({ connectionString: url }), schema }) as unknown as DB;
  }
  return drizzlePg({ client: new PgPool({ connectionString: url, max: 5 }), schema });
}

const globalForDb = globalThis as unknown as { __db?: DB };

export const db: DB = globalForDb.__db ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
