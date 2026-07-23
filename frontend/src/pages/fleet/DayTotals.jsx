import { useEffect, useState } from "react";
import { apiFleetDaySummary } from "@/lib/fleetApi";
import { fmtMoney } from "./utils";

// Απλά σύνολα ημέρας ανά οδηγό (παραδόσεις + μετρητά) για τον συντονιστή.
export default function DayTotals({ refreshKey }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFleetDaySummary(date || undefined)
      .then(setData)
      .catch(() => {});
  }, [date, refreshKey]);

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-heading font-bold text-sm">Σύνολα ημέρας</h2>
        <input
          type="date"
          value={date || (data?.date ?? "")}
          onChange={(e) => setDate(e.target.value)}
          data-testid="fleet-totals-date"
          className="ml-auto h-8 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-xs text-white focus:outline-none focus:border-flame"
        />
      </div>
      {!data || data.drivers.length === 0 ? (
        <div className="text-xs text-neutral-500">Καμία παράδοση</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-neutral-500 text-left">
              <th className="pb-1 font-semibold">Οδηγός</th>
              <th className="pb-1 font-semibold text-right">Παραδόσεις</th>
              <th className="pb-1 font-semibold text-right">Μετρητά</th>
            </tr>
          </thead>
          <tbody>
            {data.drivers.map((d) => (
              <tr key={d.driver_id || d.driver_name} className="border-t border-[#723645]/40">
                <td className="py-1.5 truncate">{d.driver_name}</td>
                <td className="py-1.5 text-right">{d.orders}</td>
                <td className="py-1.5 text-right text-gold">{fmtMoney(d.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
