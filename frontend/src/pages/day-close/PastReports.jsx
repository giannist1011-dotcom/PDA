import { Printer } from "lucide-react";
import { eur, formatGRDateTime } from "@/lib/format";
import { businessDayLabel } from "@/lib/businessDay";

// Αποθηκευμένα κλεισίματα — ακριβής επανεκτύπωση της αναφοράς που τυπώθηκε τότε
export default function PastReports({ reports, onPrint }) {
  return (
    <section
      className="mt-8 p-5 bg-[#3D1620] border border-[#723645] rounded-lg"
      data-testid="dayclose-history"
    >
      <h3 className="font-heading text-lg font-bold mb-4">Προηγούμενα κλεισίματα</h3>
      {reports.length === 0 ? (
        <div className="text-neutral-500 text-sm py-4 text-center">
          Δεν υπάρχουν αποθηκευμένες αναφορές
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#723645]">
                <th className="py-2 px-3">Ημέρα</th>
                <th className="py-2 px-3">Ώρα κλεισίματος</th>
                <th className="py-2 px-3 text-right">Παραγγελίες</th>
                <th className="py-2 px-3 text-right">Τζίρος</th>
                <th className="py-2 px-3 text-right">Καθαρό</th>
                <th className="py-2 px-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[#431A25] last:border-0"
                  data-testid={`dayreport-row-${r.id}`}
                >
                  <td className="py-2.5 px-3 text-white">{businessDayLabel(r.date)}</td>
                  <td className="py-2.5 px-3 text-neutral-400 text-sm">
                    {formatGRDateTime(r.closed_at)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-neutral-300">
                    {r.total_orders}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-gold">
                    {eur(r.total_revenue)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      r.net_result >= 0 ? "text-[#00E676]" : "text-[#FF6961]"
                    }`}
                  >
                    {eur(r.net_result)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onPrint(r)}
                      data-testid={`dayreport-print-${r.id}`}
                      className="p-2 text-neutral-400 hover:text-flame"
                      title="Επανεκτύπωση αναφοράς"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
