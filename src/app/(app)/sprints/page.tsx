import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/sprints">) {
  return <ToProject path="/sprints" searchParams={searchParams} />;
}
