import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiAdminLeads, formatApiError } from "@/lib/api";
import { businessLabel } from "@/lib/business";
import { formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import AdminShell, { useAdminPw } from "@/components/AdminShell";

const PAGE_SIZE = 50;

function exportCsv(leads) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["email", "business_name", "business_type", "created_at", "converted"],
    ...leads.map((l) => [
      l.email,
      l.business_name,
      l.business_type,
      l.created_at,
      l.converted ? "yes" : "no",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `orderdeck-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LeadsContent() {
  const pw = useAdminPw();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    apiAdminLeads(pw, { page, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-neutral-400">
          Emails από το demo mode — σύνολο{" "}
          <span className="text-white font-semibold">{data.total}</span>. Το «Μετατράπηκε»
          σημαίνει ότι το email έχει πλέον κανονικό λογαριασμό.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={load}
            data-testid="leads-refresh"
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            onClick={() => exportCsv(data.leads)}
            disabled={data.leads.length === 0}
            data-testid="leads-export"
            className="h-9 px-3 bg-brand hover:bg-brand-hover text-white font-bold"
          >
            <Download className="w-4 h-4 mr-1.5" /> Εξαγωγή CSV
          </Button>
        </div>
      </div>

      {data.leads.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Δεν υπάρχουν leads ακόμα.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="leads-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Email</th>
                <th className="px-3 py-2.5 font-bold">Επιχείρηση</th>
                <th className="px-3 py-2.5 font-bold">Τύπος</th>
                <th className="px-3 py-2.5 font-bold">Ημερομηνία</th>
                <th className="px-3 py-2.5 font-bold">Μετατράπηκε</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((l) => (
                <tr key={l.id} className="border-t border-[#723645]/50">
                  <td className="px-3 py-2.5 font-semibold">{l.email}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{l.business_name}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{businessLabel(l.business_type)}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{formatGRDateTime(l.created_at)}</td>
                  <td className="px-3 py-2.5">
                    {l.converted ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">
                        Ναι
                      </span>
                    ) : (
                      <span className="text-neutral-500 text-xs">Όχι</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm text-neutral-400">
          <Button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
            data-testid="leads-prev"
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
            data-testid="leads-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminLeads() {
  return (
    <AdminShell title="Leads" subtitle="Ενδιαφερόμενοι από το demo mode">
      <LeadsContent />
    </AdminShell>
  );
}
