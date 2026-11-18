import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/board">) {
  return <ToProject path="/board" searchParams={searchParams} />;
}
