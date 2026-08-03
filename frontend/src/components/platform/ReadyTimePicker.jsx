import { Clock } from "lucide-react";
import { READY_PRESETS } from "@/lib/platforms";

// Χρόνος παράδοσης της παραγγελίας — presets 20/30/40/50 με προεπιλογή 30΄.
// Χρησιμοποιείται και στην κάρτα «Εισερχόμενες» και στο καθολικό popup.
export default function ReadyTimePicker({ value, onChange, compact = false, testIdPrefix = "ready" }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-testid={`${testIdPrefix}-picker`}>
      {!compact && (
        <span className="flex items-center gap-1 text-xs uppercase tracking-widest text-neutral-400 font-bold mr-1">
          <Clock className="w-3.5 h-3.5" />
          Χρόνος
        </span>
      )}
      {READY_PRESETS.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            data-testid={`${testIdPrefix}-${m}`}
            data-state={active ? "on" : "off"}
            className={`${compact ? "h-9 px-2.5 text-xs" : "h-10 px-3 text-sm"} rounded-md border font-bold transition-colors no-select ${
              active
                ? "bg-flame text-white border-flame"
                : "bg-[#2A0E14] text-neutral-300 border-[#723645] hover:border-flame"
            }`}
          >
            {m}′
          </button>
        );
      })}
    </div>
  );
}
