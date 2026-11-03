"use client";

import { useActionState, useState, useTransition } from "react";
import { createApiToken, revokeApiToken } from "@/app/actions/tokens";

type Token = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

export function ApiTokens({ tokens }: { tokens: Token[] }) {
  const [state, action, pending] = useActionState(createApiToken, undefined);
  const [copied, setCopied] = useState(false);
  const [revoking, startRevoke] = useTransition();
  // token chỉ có sau khi bấm tạo (phía trình duyệt) nên đọc window ở đây an toàn
  const env = state?.token
    ? `TM_API_URL=${window.location.origin}\nTM_API_TOKEN=${state.token}`
    : null;

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Token API</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dùng để tạo / sửa việc bằng lệnh hoặc từ project khác (xem{" "}
          <code className="rounded bg-slate-100 px-1">docs/API.md</code>). Token có quyền như tài khoản của bạn.
        </p>
      </div>

      {tokens.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="font-medium">{t.name}</span>
              <code className="text-xs text-slate-500">{t.prefix}…</code>
              <span className="ml-auto text-xs text-slate-500">
                tạo {t.createdAt} · {t.lastUsedAt ? `dùng ${t.lastUsedAt}` : "chưa dùng"}
              </span>
              <button
                disabled={revoking}
                onClick={() => {
                  if (confirm(`Thu hồi token "${t.name}"? Lệnh đang dùng token này sẽ bị từ chối ngay.`)) {
                    startRevoke(() => revokeApiToken(t.id));
                  }
                }}
                className="btn-ghost py-1 text-xs text-red-700"
              >
                Thu hồi
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Tên token, vd. siroby-app" className="input w-64" />
        <button disabled={pending} className="btn-primary">
          {pending ? "Đang tạo…" : "Tạo token"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {env && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="mb-2 text-sm text-green-900">
            Token chỉ hiện <b>một lần</b>. Copy vào <code>.env.local</code> (hoặc biến môi trường) của project sẽ
            gọi API – đừng commit, đừng dán vào chat.
          </p>
          <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-xs">{env}</pre>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(env + "\n");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="btn-secondary mt-2"
          >
            {copied ? "Đã copy ✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
