import { json, withApiAuth } from "@/lib/api";
import { listSprints } from "@/lib/queries";

export const GET = withApiAuth(async () => {
  const rows = await listSprints();
  return json({ dot: rows.map((s) => ({ ma: s.code, mo_ta: s.description })) });
});
