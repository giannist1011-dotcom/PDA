import { useCallback, useEffect, useState } from "react";
import { Package, CheckCircle2, Timer, Bike, Store, CalendarDays, Clock } from "lucide-react";
import FleetShell from "@/pages/fleet/FleetShell";
import PeriodFilter from "@/components/shared/PeriodFilter";
import StatCard from "@/components/shared/StatCard";
import CountBarChart from "@/components/shared/CountBarChart";
import EmptyState from "@/components/shared/EmptyState";
import SectionHeader from "@/components/shared/SectionHeader";
import { apiFleetStats } from "@/lib/fleetApi";
import { presetRange } from "@/lib/dates";
import { daySeries, hourSeries } from "@/lib/series";
import { STATUS_META } from "@/components/fleet/utils";

// Σειρά εμφάνισης καταστάσεων (ίδια σημειολογία με τις κάρτες παραγγελιών)
const STATUS_ORDER = ["waiting", "pickup", "enroute", "delivered", "cancelled"];

const mins = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}′`);

// «Στατιστικά» εταιρείας διανομής (μόνο διαχειριστής) — απλοποιημένη εκδοχή των
// Στατιστικών του OrderDeck: ίδιο φίλτρο περιόδου, ίδιες κάρτες μετρικών, ίδια
// διαγράμματα. Χωρίς τίποτα οικονομικό (τα χρήματα είναι υπόθεση καταστήματος).
export default function FleetStats() {
  const [period, setPeriod] = useState(() => ({
    preset: "last7",
    ...(presetRange("last7") || { from: "", to: "" }),
  }));
  const [data, setData] = useState(null);

  const load = useCallback((p) => {
    apiFleetStats({
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

  const days = daySeries(data?.by_day, data?.date_from, data?.date_to);
  const hours = hourSeries(data?.by_hour);
  const drivers = data?.drivers || [];
  const stores = data?.stores || [];

  return (
    <FleetShell title="Στατιστικά">
      <div className="space-y-6">
        <PeriodFilter value={period} onChange={onPeriodChange} testIdPrefix="fleet-stats-period" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Package}
            label="Παραγγελίες"
            value={data?.total ?? "—"}
            testId="fleet-stats-total"
          />
          <StatCard
            icon={CheckCircle2}
            label="Παραδόθηκαν"
            value={data?.by_status?.delivered ?? 0}
            valueClass="text-[#5CA8FF]"
            iconClass="text-[#5CA8FF]"
            testId="fleet-stats-delivered"
          />
          <StatCard
            icon={Timer}
            label="Μέσος χρόνος"
            value={mins(data?.avg_minutes)}
            sub="Καταχώρηση → παράδοση"
            testId="fleet-stats-avg"
          />
        </div>

        {/* Ανάλυση καταστάσεων — ίδια chips με τις κάρτες παραγγελιών */}
        <div className="flex flex-wrap gap-1.5" data-testid="fleet-stats-statuses">
          {STATUS_ORDER.map((st) => {
            const meta = STATUS_META[st];
            const count = data?.by_status?.[st];
            if (!meta || !count) return null;
            return (
              <span
                key={st}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.badge}`}
              >
                {meta.emoji} {meta.label}: {count}
              </span>
            );
          })}
        </div>

        <CountBarChart
          data={days}
          title="Παραγγελίες ανά ημέρα"
          icon={CalendarDays}
          testId="fleet-stats-days"
        />

        <CountBarChart
          data={hours}
          title="Ώρες αιχμής"
          icon={Clock}
          height={220}
          testId="fleet-stats-hours"
        />

        <section data-testid="fleet-stats-drivers">
          <SectionHeader icon={Bike} title="Ανά διανομέα" size="sm" />
          {drivers.length === 0 ? (
            <EmptyState text="Καμία ανάθεση στην περίοδο" />
          ) : (
            <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[380px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-neutral-500 text-left">
                    <th className="pb-2 font-semibold">Διανομέας</th>
                    <th className="pb-2 font-semibold text-right">Παραγγελίες</th>
                    <th className="pb-2 font-semibold text-right">Παραδόθηκαν</th>
                    <th className="pb-2 font-semibold text-right">Μέσος χρόνος</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr
                      key={d.driver_id || d.driver_name}
                      className="border-t border-[#723645]/40"
                      data-testid={`fleet-stats-driver-${d.driver_id || d.driver_name}`}
                    >
                      <td className="py-2 truncate">{d.driver_name}</td>
                      <td className="py-2 text-right font-mono">{d.orders}</td>
                      <td className="py-2 text-right font-mono text-[#5CA8FF]">{d.delivered}</td>
                      <td className="py-2 text-right font-mono text-neutral-400">
                        {mins(d.avg_minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section data-testid="fleet-stats-stores">
          <SectionHeader icon={Store} title="Ανά κατάστημα" size="sm" />
          {stores.length === 0 ? (
            <EmptyState text="Καμία παραγγελία στην περίοδο" />
          ) : (
            <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
              <ul className="divide-y divide-[#723645]/40">
                {stores.map((s) => (
                  <li key={s.name} className="py-2 flex items-center gap-2 text-sm">
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="font-mono text-neutral-400 text-xs shrink-0">
                      🔵 {s.delivered}
                    </span>
                    <span className="font-mono font-bold shrink-0 w-10 text-right">{s.orders}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </FleetShell>
  );
}
