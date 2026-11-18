import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/backlog">) {
  return <ToProject path="/backlog" searchParams={searchParams} />;
}
