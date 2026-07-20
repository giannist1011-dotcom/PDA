import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { eur } from "@/lib/format";
import CompareCard from "./CompareCard";
import ChangeBadge from "./ChangeBadge";
import { pct } from "./utils";

export default function CompareSection({
  cmpFromA,
  setCmpFromA,
  cmpToA,
  setCmpToA,
  cmpFromB,
  setCmpFromB,
  cmpToB,
  setCmpToB,
  cmpLoading,
  cmpError,
  cmpDataA,
  cmpDataB,
  loadCompare,
  applyComparePreset,
  bySourceMerged,
}) {
  return (
    <div className="mt-8 p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="compare-section">
      <div className="flex items-center gap-2 mb-2">
        <ArrowLeftRight className="w-5 h-5 text-flame" />
        <h2 className="font-heading text-xl font-semibold">Σύγκριση περιόδων</h2>
      </div>
      <p className="text-sm text-neutral-400 mb-5">
        Συγκρίνετε δύο χρονικά διαστήματα δίπλα-δίπλα με ποσοστιαία μεταβολή
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">
        <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-md">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
            Περίοδος Α (προηγούμενη)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">Από</label>
              <DatePicker
                value={cmpFromA}
                onChange={setCmpFromA}
                testId="compare-from-a"
                className="w-full h-11 mt-1 bg-[#3D1620]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">Έως</label>
              <DatePicker
                value={cmpToA}
                onChange={setCmpToA}
                testId="compare-to-a"
                className="w-full h-11 mt-1 bg-[#3D1620]"
              />
            </div>
          </div>
        </div>
        <div className="p-4 bg-[#2A0E14] border border-flame/40 rounded-md">
          <div className="text-xs font-bold uppercase tracking-widest text-flame mb-3">
            Περίοδος Β (τρέχουσα)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">Από</label>
              <DatePicker
                value={cmpFromB}
                onChange={setCmpFromB}
                testId="compare-from-b"
                className="w-full h-11 mt-1 bg-[#3D1620]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">Έως</label>
              <DatePicker
                value={cmpToB}
                onChange={setCmpToB}
                testId="compare-to-b"
                className="w-full h-11 mt-1 bg-[#3D1620]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          onClick={loadCompare}
          disabled={cmpLoading}
          data-testid="compare-run-btn"
          className="h-11 px-5 bg-brand hover:bg-brand-hover text-white font-bold"
        >
          <ArrowLeftRight className="w-4 h-4 mr-2" />
          {cmpLoading ? "Υπολογισμός..." : "Σύγκριση"}
        </Button>
        {[
          { k: "yesterday-vs-today", label: "Χθες vs Σήμερα" },
          { k: "this-vs-last-week", label: "Αυτή vs Προηγ. εβδομάδα" },
          { k: "this-vs-last-month", label: "Αυτός vs Προηγ. μήνας" },
        ].map((p) => (
          <button
            key={p.k}
            onClick={() => applyComparePreset(p.k)}
            data-testid={`compare-preset-${p.k}`}
            className="h-11 px-4 rounded-md text-sm font-bold bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-flame hover:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>

      {cmpError && (
        <div className="p-3 mb-4 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF6961] text-sm">
          {cmpError}
        </div>
      )}

      {cmpDataA && cmpDataB ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <CompareCard
              label="Έσοδα"
              valueA={cmpDataA.total_revenue}
              valueB={cmpDataB.total_revenue}
              format={eur}
              testId="cmp-card-revenue"
            />
            <CompareCard
              label="Παραγγελίες"
              valueA={cmpDataA.total_orders}
              valueB={cmpDataB.total_orders}
              format={(v) => String(v)}
              testId="cmp-card-orders"
            />
            <CompareCard
              label="Μέσος όρος"
              valueA={cmpDataA.avg_order_value}
              valueB={cmpDataB.avg_order_value}
              format={eur}
              testId="cmp-card-avg"
            />
          </div>

          <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-md" data-testid="cmp-by-source-table">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
              Παραγγελίες ανά πηγή
            </div>
            {bySourceMerged.length === 0 ? (
              <div className="text-neutral-500 py-6 text-center">
                Δεν υπάρχουν δεδομένα στα δύο διαστήματα
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-neutral-500 border-b border-[#431A25]">
                      <th className="py-2 text-left">Πηγή</th>
                      <th className="py-2 text-right">Α (Παρ.)</th>
                      <th className="py-2 text-right">Β (Παρ.)</th>
                      <th className="py-2 text-right">Μεταβολή</th>
                      <th className="py-2 text-right">Α (Έσοδα)</th>
                      <th className="py-2 text-right">Β (Έσοδα)</th>
                      <th className="py-2 text-right">Μεταβολή</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySourceMerged.map((row) => (
                      <tr
                        key={row.source}
                        className="border-b border-[#431A25] last:border-0"
                        data-testid={`cmp-source-row-${row.source}`}
                      >
                        <td className="py-3 font-semibold text-white">{row.source}</td>
                        <td className="py-3 text-right font-mono text-neutral-300">
                          {row.countA}
                        </td>
                        <td className="py-3 text-right font-mono text-white">{row.countB}</td>
                        <td className="py-3 text-right">
                          <ChangeBadge value={pct(row.countB, row.countA)} />
                        </td>
                        <td className="py-3 text-right font-mono text-neutral-300">
                          {eur(row.revenueA)}
                        </td>
                        <td className="py-3 text-right font-mono text-white">
                          {eur(row.revenueB)}
                        </td>
                        <td className="py-3 text-right">
                          <ChangeBadge value={pct(row.revenueB, row.revenueA)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-neutral-500 text-center py-8 text-sm">
          Επιλέξτε δύο περιόδους και πατήστε «Σύγκριση»
        </div>
      )}
    </div>
  );
}
