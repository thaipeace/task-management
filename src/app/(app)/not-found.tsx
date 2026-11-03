import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy</h1>
      <p className="mt-2 text-sm text-slate-500">Việc này không tồn tại hoặc đã bị đổi id.</p>
      <Link href="/backlog" className="btn-secondary mt-4">
        Về backlog
      </Link>
    </div>
  );
}
