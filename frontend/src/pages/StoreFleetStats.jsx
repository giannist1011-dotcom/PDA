import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PeriodFilter from "@/components/PeriodFilter";
import { apiStoreFleetStats } from "@/lib/api";
import { presetRange } from "@/lib/dates";
import { STATUS_META } from "@/pages/fleet/utils";

// Σειρά εμφάνισης καταστάσεων στην ανάλυση (ίδια σημειολογία με τις κάρτες)
const STATUS_ORDER = ["waiting", "pickup", "enroute", "delivered", "cancelled", "scheduled"];

// «Στατιστικά» (FleetDeck καταστήματος, μόνο Ιδιοκτήτης): πλήθη ανεβασμένων
// παραγγελιών ανά περίοδο, με ανάλυση ανά εταιρεία και ανά κατάσταση —
// τίποτα οικονομικό.
export default function StoreFleetStats() {
  const [period, setPeriod] = useState(() => ({
    preset: "last7",
    ...(presetRange("last7") || { from: "", to: "" }),
  }));
  const [data, setData] = useState(null);

  const load = useCallback((p) => {
    apiStoreFleetStats({
      ...(p.from ? { date_from: p.from } : {}),
      ...(p.to ? { date_to: p.to } : {}),
    })
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPeriodChange = (next) => {
    setPeriod(next);
    load(next);
  };

  const statusChip = (st, count) => {
    const meta = STATUS_META[st];
    if (!meta || !count) return null;
    return (
      <span
        key={st}
        className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.badge}`}
      >
        {meta.emoji} {meta.label}: {count}
      </span>
    );
  };

  return (
    <AppShell title="Στατιστικά">
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        <PeriodFilter value={period} onChange={onPeriodChange} includeAll testIdPrefix="store-fleet-period" />

        <div
          className="bg-[#3D1620] border border-[#723645] rounded-lg p-4"
          data-testid="store-fleet-stats-total"
        >
          <div className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
            Ανεβασμένες παραγγελίες
          </div>
          <div className="font-heading text-3xl font-bold mt-1">{data?.total ?? "—"}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {STATUS_ORDER.map((st) => statusChip(st, data?.by_status?.[st]))}
          </div>
        </div>

        <section>
          <div className="font-heading font-bold mb-3">Ανά εταιρεία</div>
          {!data || data.companies.length === 0 ? (
            <div className="border border-dashed border-[#723645]/60 rounded-lg p-6 text-center text-sm text-neutral-500">
              Καμία παραγγελία στην περίοδο
            </div>
          ) : (
            <div className="space-y-2">
              {data.companies.map((c) => (
                <div
                  key={c.team_id}
                  className="p-3 bg-[#3D1620] border border-[#723645] rounded-lg"
                  data-testid={`store-fleet-stats-company-${c.team_id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold flex-1 truncate">{c.team_name}</span>
                    <span className="font-heading font-bold">{c.total}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {STATUS_ORDER.map((st) => statusChip(st, c.by_status?.[st]))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
