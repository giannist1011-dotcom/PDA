import { CalendarRange } from "lucide-react";
import { eur, formatGRDate } from "@/lib/format";
import ChangeBadge from "./ChangeBadge";

const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

const Metric = ({ label, current, lastYear, format = (v) => v, testId }) => {
  const delta = pct(current, lastYear);
  return (
    <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-lg" data-testid={testId}>
      <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-2">
        {label}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-heading text-2xl font-bold text-white">{format(current)}</span>
        {delta === null ? (
          <span className="text-xs text-neutral-500 font-bold">— (πέρσι: 0)</span>
        ) : (
          <ChangeBadge value={delta} testId={`${testId}-delta`} />
        )}
      </div>
      <div className="text-xs text-neutral-500 mt-1.5">
        Πέρσι: <span className="font-mono font-bold text-neutral-400">{format(lastYear)}</span>
      </div>
    </div>
  );
};

// ---------- Σύγκριση με πέρσι (ίδια περίοδος πριν 1 έτος) ----------
export default function YoYSection({ yoy }) {
  return (
    <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarRange className="w-5 h-5 text-flame" />
        <h3 className="font-heading text-lg font-bold">Σύγκριση με πέρσι</h3>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Ίδια περίοδος πριν από ένα έτος, με βάση το φίλτρο περιόδου παραπάνω.
      </p>

      {!yoy ? (
        <div className="text-sm text-neutral-500 py-2">Φόρτωση...</div>
      ) : !yoy.available ? (
        <div
          className="text-sm text-neutral-400 py-3 px-4 bg-[#2A0E14] border border-[#723645] rounded-md"
          data-testid="yoy-unavailable"
        >
          Μη διαθέσιμο — το κατάστημα δεν έχει ακόμη δεδομένα από την αντίστοιχη
          περσινή περίοδο.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Metric
              label="Έσοδα"
              current={yoy.current.revenue}
              lastYear={yoy.last_year.revenue}
              format={eur}
              testId="yoy-revenue"
            />
            <Metric
              label="Παραγγελίες"
              current={yoy.current.orders}
              lastYear={yoy.last_year.orders}
              testId="yoy-orders"
            />
          </div>
          <div className="text-xs text-neutral-500 mt-3">
            Περσινή περίοδος:{" "}
            <span className="font-mono text-neutral-400">
              {yoy.last_year.date_from === yoy.last_year.date_to
                ? formatGRDate(yoy.last_year.date_from)
                : `${formatGRDate(yoy.last_year.date_from)} – ${formatGRDate(yoy.last_year.date_to)}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
