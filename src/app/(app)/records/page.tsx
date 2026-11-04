import type { Metadata } from "next";
import { Suspense } from "react";
import { EditableRecord, NewRecord } from "@/components/inline-forms";
import { IdLinks, RichText } from "@/components/rich-text";
import { Loading, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentProject } from "@/lib/projects";
import { getMeta, listRecords } from "@/lib/queries";

export const metadata: Metadata = { title: "Rủi ro & quyết định" };

export default function RecordsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Rủi ro & quyết định"
        subtitle="chap_nhan_rui_ro (AR) = đã xem và quyết không sửa · cho_quyet_dinh (QD) = câu hỏi chặn việc"
      />
      <Suspense fallback={<Loading />}>
        <RecordsContent />
      </Suspense>
    </div>
  );
}

async function RecordsContent() {
  const [me, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const [risks, decisions, notes] = await Promise.all([
    listRecords(project.id, "risk"),
    listRecords(project.id, "decision"),
    getMeta(project.id, "ghi_chu_ngoai_pham_vi"),
  ]);
  const pid = project.id;
  const canDelete = me.role === "admin";
  const s = (v: unknown) => (v == null ? "" : String(v));

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chờ quyết định ({decisions.length})</h2>
          <NewRecord projectId={pid} kind="decision" label="Thêm câu hỏi" />
        </div>
        <div className="space-y-3">
          {decisions.map((r) => (
            <EditableRecord key={r.key} projectId={pid} kind="decision" recordKey={r.key} data={r.data} canDelete={canDelete}>
              <RichText text={s(r.data.cau_hoi)} className="block text-sm leading-relaxed" />
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  <span className="text-slate-500">Ai quyết: </span>
                  <b>{s(r.data.ai) || "—"}</b>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500">Chặn việc:</span>
                  <IdLinks ids={Array.isArray(r.data.chan_viec) ? (r.data.chan_viec as string[]) : []} />
                </span>
              </div>
            </EditableRecord>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rủi ro đã chấp nhận ({risks.length})</h2>
          <NewRecord projectId={pid} kind="risk" label="Thêm rủi ro" />
        </div>
        <div className="space-y-3">
          {risks.map((r) => (
            <EditableRecord key={r.key} projectId={pid} kind="risk" recordKey={r.key} data={r.data} canDelete={canDelete}>
              <h3 className="font-semibold">{s(r.data.tieu_de)}</h3>
              <p className="mt-1 text-xs text-slate-500">{s(r.data.nguon)}</p>
              <RichText text={s(r.data.danh_gia)} className="mt-2 block text-sm leading-relaxed" />
              {s(r.data.xem_lai_khi) && (
                <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <b>Xem lại khi:</b> {s(r.data.xem_lai_khi)}
                </p>
              )}
            </EditableRecord>
          ))}
        </div>
      </section>

      {Array.isArray(notes) && notes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Ghi chú ngoài phạm vi ({notes.length})</h2>
          <ul className="space-y-3">
            {(notes as { ngay?: string; ghi?: string }[]).map((n, i) => (
              <li key={i} className="card p-4 text-sm">
                <div className="mb-1 font-mono text-xs text-slate-500">{n.ngay}</div>
                <RichText text={s(n.ghi)} className="leading-relaxed" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Chỉ đọc – sửa trong tệp rồi import lại.</p>
        </section>
      )}
    </div>
  );
}
