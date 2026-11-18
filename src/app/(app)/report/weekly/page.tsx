import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/report/weekly">) {
  return <ToProject path="/report/weekly" searchParams={searchParams} />;
}
