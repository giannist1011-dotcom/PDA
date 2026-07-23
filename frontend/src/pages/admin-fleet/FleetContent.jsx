import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiAdminListFleet, formatApiError } from "@/lib/api";
import { formatGRDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useAdminPw } from "@/components/AdminShell";
import { StatusBadge } from "../admin-shops/Badges";
import { inputCls } from "../admin-shops/utils";
import FleetModal from "./FleetModal";
import { FLEET_PLAN_LABELS } from "./utils";

const PAGE_SIZE = 20;

// ============ ΛΙΣΤΑ ΕΤΑΙΡΙΩΝ DELIVERY ============
function FleetContent() {
  const pw = useAdminPw();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    apiAdminListFleet(pw, { search, status, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, search, status, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Αναζήτηση ονόματος ή email..."
            data-testid="fleet-search"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          data-testid="fleet-filter-status"
          className={inputCls}
        >
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργές</option>
          <option value="disabled">Ανενεργές</option>
          <option value="demo">Demo</option>
        </select>
      </div>

      {/* TABLE */}
      {!data ? (
        <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>
      ) : data.companies.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Δεν βρέθηκαν εταιρίες delivery με αυτά τα φίλτρα.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="fleet-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Εταιρία</th>
                <th className="px-3 py-2.5 font-bold">Πόλη</th>
                <th className="px-3 py-2.5 font-bold">Πλάνο</th>
                <th className="px-3 py-2.5 font-bold text-right">Διανομείς</th>
                <th className="px-3 py-2.5 font-bold text-right">Παραγγελίες (30ημ)</th>
                <th className="px-3 py-2.5 font-bold">Εγγραφή</th>
                <th className="px-3 py-2.5 font-bold">Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  data-testid={`fleet-row-${c.id}`}
                  className="border-t border-[#723645]/50 hover:bg-[#3D1620]/60 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{c.restaurant_name}</div>
                    <div className="text-xs text-neutral-500">{c.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-300">{c.city || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-300">
                    {FLEET_PLAN_LABELS[c.plan] || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{c.drivers_count}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{c.orders_30d}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{formatGRDate(c.created_at)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>
            Σύνολο: <span className="text-white font-semibold">{data.total}</span> εταιρίες
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
              data-testid="fleet-prev"
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
              data-testid="fleet-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <FleetModal pw={pw} companyId={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

export default FleetContent;
