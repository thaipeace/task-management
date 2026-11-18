import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui";

// Link cũ /report/releases/SIA/2.45.8-rc1 → /SIA/report/releases/2.45.8-rc1
export default function Page({ params }: PageProps<"/report/releases/[project]/[version]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Go params={params} />
    </Suspense>
  );
}

async function Go({ params }: Pick<PageProps<"/report/releases/[project]/[version]">, "params">): Promise<never> {
  const p = await params;
  redirect(`/${decodeURIComponent(p.project).toUpperCase()}/report/releases/${p.version}`);
}
