import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/tasks/new">) {
  return <ToProject path="/tasks/new" searchParams={searchParams} />;
}
