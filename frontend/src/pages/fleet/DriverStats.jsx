import { useCallback, useEffect, useState } from "react";
import { Store, CalendarDays, Clock3 } from "lucide-react";
import PeriodFilter from "@/components/shared/PeriodFilter";
import CountBarChart from "@/components/shared/CountBarChart";
import { apiFleetDriverStats } from "@/lib/fleetApi";
import { presetRange } from "@/lib/dates";
import { formatGRDayMonth } from "@/lib/format";
import { daySeries } from "@/lib/series";

// Συμπαγής κάρτα μετρικής για την οθόνη κινητού του οδηγού — ίδια tokens με το
// StatCard του OrderDeck, μικρότερο padding ώστε να χωράνε τρεις σε μία σειρά.
const Tile = ({ label, value }) => (
  <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-3 text-center">
    <div className="font-mono text-2xl font-bold">{value}</div>
    <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mt-0.5">
      {label}
    </div>
  </div>
);

// Τα στατιστικά του ίδιου του οδηγού — απλοποιημένη εκδοχή των Στατιστικών του
// OrderDeck: ίδιο φίλτρο περιόδου και ίδια διαγράμματα, με τα δικά του νούμερα
// (παραδόσεις ανά ημέρα, ανά κατάστημα, ανά βάρδια).
export default function DriverStats() {
  const [period, setPeriod] = useState(() => ({
    preset: "last7",
    ...(presetRange("last7") || { from: "", to: "" }),
  }));
  const [stats, setStats] = useState(null);

  const load = useCallback((p) => {
    apiFleetDriverStats({
      ...(p.from ? { date_from: p.from } : {}),
      ...(p.to ? { date_to: p.to } : {}),
    })
      .then(setStats)
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

  const days = daySeries(stats?.by_day, stats?.date_from, stats?.date_to);
  const stores = stats?.by_store || [];
  const shifts = stats?.by_shift || [];

  return (
    <div className="space-y-4" data-testid="fleet-drv-stats">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Σήμερα" value={stats?.today ?? "—"} />
        <Tile label="Εβδομάδα" value={stats?.week ?? "—"} />
        <Tile label="Σύνολο" value={stats?.total ?? "—"} />
      </div>
      <div className="text-xs text-neutral-500 text-center -mt-2">Παραδομένες παραγγελίες</div>

      {(stats?.shift_hours_today > 0 || stats?.shift_hours_week > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Ώρες βάρδιας σήμερα"
            value={String(stats.shift_hours_today).replace(".", ",")}
          />
          <Tile label="Ώρες εβδομάδας" value={String(stats.shift_hours_week).replace(".", ",")} />
        </div>
      )}

      <PeriodFilter value={period} onChange={onPeriodChange} testIdPrefix="fleet-drv-period" />

      <CountBarChart
        data={days}
        title="Παραδόσεις ανά ημέρα"
        icon={CalendarDays}
        height={200}
        valueLabel="Παραδόσεις"
        testId="fleet-drv-days"
      />

      <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
        <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
          <Store className="w-4 h-4 text-flame" /> Ανά κατάστημα
        </h2>
        {stores.length === 0 ? (
          <div className="text-xs text-neutral-500">Καμία παράδοση στην περίοδο</div>
        ) : (
          <ul className="divide-y divide-[#723645]/40">
            {stores.map((s) => (
              <li key={s.name} className="py-2 flex items-center gap-2 text-sm">
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-mono font-bold">{s.orders}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
        <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-flame" /> Ανά βάρδια
        </h2>
        {shifts.length === 0 ? (
          <div className="text-xs text-neutral-500">Καμία βάρδια στην περίοδο</div>
        ) : (
          <ul className="divide-y divide-[#723645]/40">
            {shifts.map((s, i) => (
              <li
                key={`${s.day}-${s.start}-${i}`}
                className="py-2 flex items-center gap-2 text-sm"
                data-testid="fleet-drv-shift-row"
              >
                <span className="text-neutral-400 shrink-0 w-12">{formatGRDayMonth(s.day)}</span>
                <span className="font-mono text-xs text-neutral-300">
                  {s.start}–{s.end || "τώρα"}
                </span>
                <span className="ml-auto font-mono text-xs text-neutral-500 shrink-0">
                  {String(s.hours).replace(".", ",")} ώρ.
                </span>
                <span className="font-mono font-bold shrink-0 w-8 text-right">{s.orders}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
