import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/goals">) {
  return <ToProject path="/goals" searchParams={searchParams} />;
}
