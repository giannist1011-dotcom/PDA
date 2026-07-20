import { useEffect, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import {
  WEEK_ORDER,
  DAY_LABELS,
  hasAnyHours,
  computeOpenState,
  opensAtLabel,
  dayScheduleLabel,
  athensNow,
} from "./hoursUtils";

// Badge «Ανοιχτά τώρα / Κλειστά» + expandable πλήρες εβδομαδιαίο ωράριο
export default function HoursBadge({ hours }) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState(() => computeOpenState(hours));

  // Ανανέωση κάθε λεπτό ώστε το badge να γυρίζει μόνο του όταν αλλάζει η κατάσταση
  useEffect(() => {
    setState(computeOpenState(hours));
    const t = setInterval(() => setState(computeOpenState(hours)), 60_000);
    return () => clearInterval(t);
  }, [hours]);

  if (!hasAnyHours(hours)) return null;

  const { open, opensAt } = state;
  const todayKey = athensNow().dayKey;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        data-testid="hours-badge"
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
          open
            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
            : "bg-[#3D1620] border-[#723645] text-neutral-300"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${open ? "bg-emerald-400" : "bg-neutral-500"}`}
        />
        {open
          ? "Ανοιχτά τώρα"
          : opensAt
          ? `Κλειστά — ${opensAtLabel(opensAt)}`
          : "Κλειστά"}
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div
          className="mt-3 mx-auto max-w-xs text-left bg-[#2A0E14] border border-[#3D1620] rounded-xl p-4"
          data-testid="hours-full"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
            <Clock className="w-3.5 h-3.5" />
            Ωράριο λειτουργίας
          </div>
          <ul className="space-y-1">
            {WEEK_ORDER.map((k) => (
              <li
                key={k}
                className={`flex justify-between gap-3 text-sm ${
                  k === todayKey ? "text-white font-semibold" : "text-neutral-400"
                }`}
              >
                <span>{DAY_LABELS[k]}</span>
                <span className="font-mono text-xs pt-0.5">{dayScheduleLabel(hours, k)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
