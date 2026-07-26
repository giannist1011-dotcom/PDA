import { useEffect, useState } from "react";
import { apiFleetDaySummary } from "@/lib/fleetApi";

const dateCls =
  "h-8 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-xs text-white focus:outline-none focus:border-flame";

// Πλήθη παραγγελιών ανά οδηγό (σήμερα ή επιλεγόμενο εύρος) για τον συντονιστή —
// χωρίς ποσά/μετρητά. Περιλαμβάνει και το driver προφίλ του συντονιστή.
export default function DayTotals({ refreshKey }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFleetDaySummary(from || undefined, (to || from) || undefined)
      .then(setData)
      .catch(() => {});
  }, [from, to, refreshKey]);

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="font-heading font-bold text-sm">Παραγγελίες ανά οδηγό</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <input
            type="date"
            value={from || (data?.date ?? "")}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="fleet-totals-date"
            className={dateCls}
          />
          <span className="text-xs text-neutral-500">–</span>
          <input
            type="date"
            value={to || from || (data?.date_to ?? data?.date ?? "")}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            data-testid="fleet-totals-date-to"
            className={dateCls}
          />
        </div>
      </div>
      {!data || data.drivers.length === 0 ? (
        <div className="text-xs text-neutral-500">Κανένας οδηγός</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-neutral-500 text-left">
              <th className="pb-1 font-semibold">Οδηγός</th>
              <th className="pb-1 font-semibold text-right">Παραγγελίες</th>
              <th className="pb-1 font-semibold text-right">Παραδόθηκαν</th>
            </tr>
          </thead>
          <tbody>
            {data.drivers.map((d) => (
              <tr key={d.driver_id || d.driver_name} className="border-t border-[#723645]/40">
                <td className="py-1.5 truncate">{d.driver_name}</td>
                <td className="py-1.5 text-right">{d.orders}</td>
                <td className="py-1.5 text-right text-gold">{d.delivered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
