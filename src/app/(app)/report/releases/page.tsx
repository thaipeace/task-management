import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/report/releases">) {
  return <ToProject path="/report/releases" searchParams={searchParams} />;
}
