import { ToProject } from "@/components/to-project";

export default function Page({ searchParams }: PageProps<"/records">) {
  return <ToProject path="/records" searchParams={searchParams} />;
}
