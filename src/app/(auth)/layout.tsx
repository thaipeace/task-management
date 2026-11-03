export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
            TB
          </span>
          <span className="text-lg font-semibold">Task Board</span>
        </div>
        <div className="card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
