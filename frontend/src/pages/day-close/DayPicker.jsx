import { CalendarDays, Lock } from "lucide-react";
import { businessDayLabel } from "@/lib/businessDay";

// Επιλογή ΕΡΓΑΣΙΜΗΣ ημέρας για το Z. Η τρέχουσα είναι πρώτη· οι προηγούμενες
// είναι μόνο για ανάγνωση/επανεκτύπωση (δεν ξανακλείνουν).
export default function DayPicker({ days, value, onChange, today }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        Εργάσιμη ημέρα
      </label>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-flame shrink-0" />
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          data-testid="dayclose-day-select"
          className="h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm font-bold focus:outline-none focus:border-flame min-w-[240px]"
        >
          {(days || []).map((d) => (
            <option key={d.date} value={d.date}>
              {businessDayLabel(d.date)}
              {d.date === today ? " — τρέχουσα" : ""}
              {d.orders ? ` · ${d.orders} παρ.` : ""}
              {d.closed ? " ✓" : ""}
            </option>
          ))}
        </select>
        {value && value !== today && (
          <span
            data-testid="dayclose-readonly-badge"
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#4A1B27] text-neutral-300 border border-[#723645]"
          >
            <Lock className="w-3 h-3" /> Αρχείο
          </span>
        )}
      </div>
    </div>
  );
}
