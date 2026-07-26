import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { apiFleetDriverStats } from "@/lib/fleetApi";

// Στατιστικά του ίδιου του οδηγού: σήμερα / εβδομάδα / σύνολο + κορυφαία
// καταστήματα παραλαβής. Φορτώνει όταν ανοίξει το tab.
export default function DriverStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFleetDriverStats().then(setStats).catch(() => {});
  }, []);

  if (!stats)
    return <div className="text-sm text-neutral-400 text-center py-6">Φόρτωση...</div>;

  const tiles = [
    ["Σήμερα", stats.today],
    ["Εβδομάδα", stats.week],
    ["Σύνολο", stats.total],
  ];

  return (
    <div className="space-y-4" data-testid="fleet-drv-stats">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([label, n]) => (
          <div
            key={label}
            className="bg-[#3D1620] border border-[#723645] rounded-lg p-3 text-center"
          >
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-neutral-500 text-center -mt-2">Παραδομένες παραγγελίες</div>

      {(stats.shift_hours_today > 0 || stats.shift_hours_week > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Ώρες βάρδιας σήμερα", stats.shift_hours_today],
            ["Ώρες εβδομάδας", stats.shift_hours_week],
          ].map(([label, n]) => (
            <div
              key={label}
              className="bg-[#3D1620] border border-[#723645] rounded-lg p-3 text-center"
            >
              <div className="text-xl font-bold">{String(n).replace(".", ",")}</div>
              <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
        <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
          <Store className="w-4 h-4 text-flame" /> Κορυφαία καταστήματα
        </h2>
        {stats.top_stores.length === 0 ? (
          <div className="text-xs text-neutral-500">Καμία παράδοση ακόμα</div>
        ) : (
          <ul className="divide-y divide-[#723645]/40">
            {stats.top_stores.map((s) => (
              <li key={s.name} className="py-2 flex items-center gap-2 text-sm">
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-bold">{s.orders}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
