import { getCurrentUser } from "@/lib/auth";
import { ReportTabLinks } from "./report-tab-links";

export async function ReportTabs() {
  const me = await getCurrentUser();
  return <ReportTabLinks isAdmin={me?.role === "admin"} />;
}
