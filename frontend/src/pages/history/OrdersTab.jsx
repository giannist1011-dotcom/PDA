import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ORDER_SOURCES } from "@/data/menu";
import { eur, formatGRDateTime } from "@/lib/format";
import PeriodFilter, { periodLabel } from "@/components/PeriodFilter";
import ScheduledBadge from "./ScheduledBadge";
import { typeLabel, sourceBadgeCls } from "./utils";

const HISTORY_SOURCES = [...ORDER_SOURCES, "Τραπέζι"];

export default function OrdersTab({
  period,
  setPeriod,
  submitSearch,
  source,
  setSource,
  search,
  setSearch,
  totalCount,
  loading,
  orders,
  setSelectedOrder,
  hasMore,
  loadOrders,
}) {
  return (
    <>
      {/* Filters */}
      <div className="p-4 bg-[#3D1620] border border-[#723645] rounded-lg mb-5 space-y-3">
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          includeAll
          testIdPrefix="history"
        />
        <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
              Πηγή
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              data-testid="history-source-select"
              className="h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            >
              <option value="all">Όλες</option>
              {HISTORY_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
              Αναζήτηση
            </label>
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Αρ. παραγγελίας, τηλέφωνο ή όνομα..."
                data-testid="history-search-input"
                className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
              />
              <Button
                type="submit"
                data-testid="history-search-btn"
                className="h-11 bg-brand hover:bg-brand-hover px-4"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </form>
        {/* Επιλεγμένο εύρος + συνολικό πλήθος για τα τρέχοντα φίλτρα */}
        <div
          className="pt-3 border-t border-[#431A25] text-sm text-neutral-300"
          data-testid="history-period-summary"
        >
          <span className="font-mono font-bold text-white">{periodLabel(period)}</span>
          {totalCount != null && (
            <span className="text-neutral-400">
              {" · "}
              {totalCount} {totalCount === 1 ? "παραγγελία" : "παραγγελίες"}
            </span>
          )}
        </div>
      </div>

      {/* Orders list */}
      {loading && orders.length === 0 ? (
        <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
      ) : orders.length === 0 ? (
        <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
          Δεν βρέθηκαν παραγγελίες
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                data-testid={`history-order-${o.id}`}
                className={`w-full flex items-center gap-4 p-4 bg-[#3D1620] border rounded-lg text-left transition-colors hover:border-flame ${
                  o.cancelled ? "border-[#FF3B30]/40 opacity-70" : "border-[#723645]"
                }`}
              >
                <div className="font-mono font-bold text-lg text-white w-16 shrink-0">
                  #{String(o.order_number).padStart(3, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        sourceBadgeCls[o.source] || "bg-[#723645] text-neutral-300"
                      }`}
                    >
                      {o.source}
                    </span>
                    <span className="text-xs text-neutral-400">{typeLabel(o)}</span>
                    {o.cancelled && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
                        Ακυρωμένη
                      </span>
                    )}
                    <ScheduledBadge order={o} />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {formatGRDateTime(o.created_at)}
                    {o.delivery?.name ? ` · ${o.delivery.name}` : ""}
                    {o.delivery?.phone ? ` · ${o.delivery.phone}` : ""}
                  </div>
                </div>
                <div
                  className={`font-mono font-bold text-lg shrink-0 ${
                    o.cancelled ? "text-neutral-500 line-through" : "text-white"
                  }`}
                >
                  {eur(o.total)}
                </div>
              </button>
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                onClick={() => loadOrders({ append: true, skip: orders.length })}
                disabled={loading}
                data-testid="history-load-more"
                className="h-11 px-6 bg-[#3D1620] border border-[#723645] hover:border-flame text-white font-bold"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                {loading ? "Φόρτωση..." : "Περισσότερες"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
