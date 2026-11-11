import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";

// Đường dẫn release luôn có mã dự án: /report/releases → /report/releases/<dự án đang chọn>
export default function ReleasesIndex() {
  return (
    <Suspense fallback={<Loading />}>
      <Go />
    </Suspense>
  );
}

async function Go(): Promise<never> {
  const [, project] = await Promise.all([requireUser(), getCurrentProject()]);
  redirect(`/report/releases/${project.code}`);
}
