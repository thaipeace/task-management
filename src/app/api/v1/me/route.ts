import { json, withApiAuth } from "@/lib/api";

export const GET = withApiAuth(async (_req, me) => json(me));
