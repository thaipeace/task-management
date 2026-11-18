import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/report">) {
  return <ToProject path="/report" searchParams={searchParams} />;
}
