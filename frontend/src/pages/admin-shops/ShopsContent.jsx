import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiAdminListShops, formatApiError } from "@/lib/api";
import { businessLabel } from "@/lib/business";
import { formatGRDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { useAdminPw } from "@/components/AdminShell";
import { OnboardingCell, StatusBadge } from "./Badges";
import ShopModal from "./ShopModal";
import { inputCls, PLAN_LABELS } from "./utils";

const PAGE_SIZE = 20;

// ============ LIST PAGE ============
function ShopsContent() {
  const pw = useAdminPw();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [businessType, setBusinessType] = useState("all");
  const [regFrom, setRegFrom] = useState("");
  const [regTo, setRegTo] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    apiAdminListShops(pw, {
      search,
      status,
      business_type: businessType,
      reg_from: regFrom,
      reg_to: regTo,
      page,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, search, status, businessType, regFrom, regTo, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Αναζήτηση ονόματος ή email..."
            data-testid="shops-search"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          data-testid="shops-filter-status"
          className={inputCls}
        >
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργά</option>
          <option value="disabled">Ανενεργά</option>
          <option value="demo">Demo</option>
        </select>
        <select
          value={businessType}
          onChange={(e) => {
            setBusinessType(e.target.value);
            setPage(1);
          }}
          data-testid="shops-filter-type"
          className={inputCls}
        >
          <option value="all">Όλοι οι τύποι</option>
          <option value="souvlaki">Σουβλατζίδικο</option>
          <option value="cafe">Καφετέρια</option>
          <option value="pizzeria">Πιτσαρία</option>
          <option value="burger">Burger</option>
        </select>
        <div className="flex gap-2">
          <DatePicker
            value={regFrom}
            onChange={(v) => {
              setRegFrom(v);
              setPage(1);
            }}
            clearable
            placeholder="Εγγραφή από"
            testId="shops-reg-from"
            className="w-full h-10 px-2 text-sm"
          />
          <DatePicker
            value={regTo}
            onChange={(v) => {
              setRegTo(v);
              setPage(1);
            }}
            clearable
            placeholder="έως"
            testId="shops-reg-to"
            className="w-full h-10 px-2 text-sm"
          />
        </div>
      </div>

      {/* TABLE */}
      {!data ? (
        <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>
      ) : data.shops.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Δεν βρέθηκαν μαγαζιά με αυτά τα φίλτρα.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="shops-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Μαγαζί</th>
                <th className="px-3 py-2.5 font-bold">Τύπος</th>
                <th className="px-3 py-2.5 font-bold">Εγγραφή</th>
                <th className="px-3 py-2.5 font-bold">Τελ. δραστ.</th>
                <th className="px-3 py-2.5 font-bold text-right">Παραγγελίες</th>
                <th className="px-3 py-2.5 font-bold">Κατάσταση</th>
                <th className="px-3 py-2.5 font-bold">Onboarding</th>
                <th className="px-3 py-2.5 font-bold">Promo</th>
                <th className="px-3 py-2.5 font-bold">Πλάνο</th>
              </tr>
            </thead>
            <tbody>
              {data.shops.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  data-testid={`shop-row-${s.id}`}
                  className="border-t border-[#723645]/50 hover:bg-[#3D1620]/60 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{s.restaurant_name}</div>
                    <div className="text-xs text-neutral-500">{s.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-300">{businessLabel(s.business_type)}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{formatGRDate(s.created_at)}</td>
                  <td className="px-3 py-2.5 text-neutral-300">
                    {s.last_activity ? formatGRDate(s.last_activity) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{s.orders_count}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-2.5" data-testid={`shop-onboarding-${s.id}`}>
                    <OnboardingCell onboarding={s.onboarding} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gold">{s.promo?.code || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{PLAN_LABELS[s.plan] || "—"}</td>
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
            Σύνολο: <span className="text-white font-semibold">{data.total}</span> μαγαζιά
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
              data-testid="shops-prev"
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
              data-testid="shops-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <ShopModal pw={pw} shopId={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

export default ShopsContent;
