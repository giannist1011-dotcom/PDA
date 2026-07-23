import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { apiAdminAudit, formatApiError } from "@/lib/api";
import { formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AUDIT_ACTION_LABELS } from "./utils";

const PAGE_SIZE = 50;

// ============ AUDIT LOG (ποιος/τι/πότε) — ορατό μόνο στον master ============
function AuditSection({ pw }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    apiAdminAudit(pw, { page, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-lg font-bold flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-flame" /> Ιστορικό ενεργειών
      </h2>
      {!data ? (
        <div className="text-neutral-500 py-10 text-center">Φόρτωση...</div>
      ) : data.entries.length === 0 ? (
        <div className="text-center text-neutral-500 py-10 border border-dashed border-[#723645] rounded-lg">
          Δεν έχουν καταγραφεί ενέργειες ακόμη.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Πότε</th>
                <th className="px-3 py-2.5 font-bold">Διαχειριστής</th>
                <th className="px-3 py-2.5 font-bold">Ενέργεια</th>
                <th className="px-3 py-2.5 font-bold">Λογαριασμός</th>
                <th className="px-3 py-2.5 font-bold">Λεπτομέρειες</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((a) => (
                <tr key={a.id} className="border-t border-[#723645]/50">
                  <td className="px-3 py-2.5 text-neutral-300 whitespace-nowrap">
                    {formatGRDateTime(a.created_at)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {a.admin_id === "platform_admin" ? "Master" : a.admin_name || a.admin_id}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-300">
                    {AUDIT_ACTION_LABELS[a.action] || a.action}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-300">
                    {a.restaurant_name || "—"}
                    {a.profile_name ? ` · ${a.profile_name}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500 font-mono">
                    {a.details || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm text-neutral-400">
          <Button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
            data-testid="audit-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
            data-testid="audit-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default AuditSection;
