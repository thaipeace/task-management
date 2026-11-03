import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // migration chạy qua kết nối trực tiếp (không qua pooler) theo khuyến nghị của Neon
  dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)! },
});
