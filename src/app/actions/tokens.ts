"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { generateApiToken } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export type TokenState = { error?: string; token?: string } | undefined;

export async function createApiToken(_: TokenState, form: FormData): Promise<TokenState> {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Đặt tên để nhớ token dùng ở đâu (vd. siroby-app)" };
  const { token, hash, prefix } = generateApiToken();
  await db.insert(apiTokens).values({ userId: me.id, name: name.slice(0, 100), tokenHash: hash, prefix });
  refresh();
  // token gốc chỉ trả về một lần – DB chỉ giữ bản băm
  return { token };
}

export async function revokeApiToken(id: number) {
  const me = await requireUser();
  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, me.id)));
  refresh();
}
