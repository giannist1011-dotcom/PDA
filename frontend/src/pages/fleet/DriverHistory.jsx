import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import PeriodFilter, { periodLabel } from "@/components/PeriodFilter";
import { apiFleetDriverOrders } from "@/lib/fleetApi";
import { presetRange } from "@/lib/dates";
import { DriverCard, EmptyState } from "./DriverCard";

const PAGE = 20;

// Ιστορικό παραγγελιών του οδηγού με φίλτρο περιόδου (μία ημέρα ή εύρος) —
// όχι μόνο οι σημερινές. Pagination με «Περισσότερες».
export default function DriverHistory({ city }) {
  const [period, setPeriod] = useState(() => ({ preset: "last7", ...presetRange("last7") }));
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback((p, skip) => {
    const params = { skip, limit: PAGE };
    if (p.from) params.date_from = p.from;
    if (p.to) params.date_to = p.to;
    return apiFleetDriverOrders(params);
  }, []);

  useEffect(() => {
    let alive = true;
    setOrders(null);
    fetchPage(period, 0)
      .then((r) => {
        if (!alive) return;
        setOrders(r.orders);
        setTotal(r.total);
      })
      .catch(() => alive && setOrders([]));
    return () => {
      alive = false;
    };
  }, [period, fetchPage]);

  const loadMore = async () => {
    setBusy(true);
    try {
      const r = await fetchPage(period, orders.length);
      setOrders((o) => [...o, ...r.orders]);
      setTotal(r.total);
    } catch {
      /* δίκτυο — ο χρήστης ξαναπατάει */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="fleet-drv-history">
      <div className="flex items-center gap-2 text-sm font-bold">
        <History className="w-4 h-4 text-flame" /> Ιστορικό
        <span className="ml-auto text-xs font-normal text-neutral-400">
          {periodLabel(period)} · {total}
        </span>
      </div>
      <PeriodFilter
        value={period}
        onChange={setPeriod}
        includeAll
        pickerClassName="h-10 px-2 text-sm"
        testIdPrefix="fleet-drv-period"
      />
      {orders === null ? (
        <div className="text-sm text-neutral-400 text-center py-4">Φόρτωση...</div>
      ) : orders.length === 0 ? (
        <EmptyState text="Καμία παραγγελία στην περίοδο" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <DriverCard key={o.id} o={o} city={city} dim showStatus />
          ))}
          {orders.length < total && (
            <button
              disabled={busy}
              onClick={loadMore}
              data-testid="fleet-drv-history-more"
              className="w-full h-12 rounded-lg border border-[#723645]/60 text-sm text-neutral-400 active:bg-[#3D1620] disabled:opacity-60"
            >
              Περισσότερες ({orders.length}/{total})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
