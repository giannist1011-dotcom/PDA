import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Package, Truck } from "lucide-react";
import AppShell from "@/components/AppShell";
import PeriodFilter from "@/components/PeriodFilter";
import StatCard from "@/components/StatCard";
import CountBarChart from "@/components/CountBarChart";
import EmptyState from "@/components/EmptyState";
import { apiStoreFleetStats } from "@/lib/api";
import { presetRange } from "@/lib/dates";
import { daySeries } from "@/lib/series";
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

  const days = daySeries(data?.by_day, period.from, period.to);

  return (
    <AppShell title="Στατιστικά">
      <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full">
        <PeriodFilter value={period} onChange={onPeriodChange} includeAll testIdPrefix="store-fleet-period" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={Package}
            label="Ανεβασμένες παραγγελίες"
            value={data?.total ?? "—"}
            testId="store-fleet-stats-total"
          />
          <StatCard
            icon={CheckCircle2}
            label="Παραδόθηκαν"
            value={data?.by_status?.delivered ?? 0}
            valueClass="text-[#5CA8FF]"
            iconClass="text-[#5CA8FF]"
            testId="store-fleet-stats-delivered"
          />
        </div>

        {/* Ανάλυση καταστάσεων — ίδια chips με τις κάρτες παραγγελιών */}
        <div className="flex flex-wrap gap-1.5" data-testid="store-fleet-stats-statuses">
          {STATUS_ORDER.map((st) => statusChip(st, data?.by_status?.[st]))}
        </div>

        <CountBarChart
          data={days}
          title="Ανεβασμένες ανά ημέρα"
          icon={CalendarDays}
          testId="store-fleet-stats-days"
        />

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-flame" />
            <h2 className="font-heading font-semibold text-lg">Ανά εταιρεία</h2>
          </div>
          {!data || data.companies.length === 0 ? (
            <EmptyState text="Καμία παραγγελία στην περίοδο" />
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
