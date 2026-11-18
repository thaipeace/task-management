import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ToProject } from "@/components/to-project";
import { Loading } from "@/components/ui";

// Link cũ /report/releases/SIA → /SIA/report/releases; /report/releases/2.45.8-rc1 (chưa có mã dự án) → dự án dùng gần nhất
export default function Page({ params }: PageProps<"/report/releases/[project]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Go params={params} />
    </Suspense>
  );
}

async function Go({ params }: Pick<PageProps<"/report/releases/[project]">, "params">) {
  const code = decodeURIComponent((await params).project);
  if (/^\d+\.\d+\.\d+/.test(code)) return <ToProject path={`/report/releases/${code}`} />;
  redirect(`/${code.toUpperCase()}/report/releases`);
}
