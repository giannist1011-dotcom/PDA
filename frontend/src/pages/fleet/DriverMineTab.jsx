import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { DriverCard } from "./DriverCard";
import EmptyState from "@/components/shared/EmptyState";
import DriverHistory from "./DriverHistory";
import { NEXT_ACTION } from "@/components/fleet/utils";

// Το tab «Οι παραγγελίες μου» του οδηγού: κάρτες με κουμπί προόδου +
// «Πρόβλημα», παραδομένες σήμερα και ιστορικό. Ο χάρτης ΔΕΝ ζει εδώ — είναι
// κεφαλίδα ολόκληρης της σελίδας (DriverMapHeader), κοινός με τις «Ελεύθερες».
// Το state της σελίδας (board, busyId, highlight) μένει στο FleetDriver.jsx.
export default function DriverMineTab({
  mine,
  delivered,
  city,
  busyId,
  onAdvance,
  onProblem,
  highlightId,
}) {
  const [showDelivered, setShowDelivered] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <section className="space-y-4">
      {mine.length === 0 ? (
        <EmptyState text="Καμία ενεργή παραγγελία" />
      ) : (
        <div className="space-y-3">
          {mine.map((o) => (
            <DriverCard key={o.id} o={o} city={city} highlight={highlightId === o.id}>
              <button
                disabled={busyId === o.id}
                onClick={() => onAdvance(o)}
                data-testid={`fleet-advance-${o.id}`}
                className="w-full h-14 mt-3 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-base disabled:opacity-60"
              >
                {NEXT_ACTION[o.status]?.label}
              </button>
              {o.problem ? (
                <div className="mt-2 text-xs text-gold text-center font-semibold">
                  ⚠️ Το πρόβλημα στάλθηκε — περιμένετε τη διαχείριση
                </div>
              ) : (
                <button
                  disabled={busyId === o.id}
                  onClick={() => onProblem(o)}
                  data-testid={`fleet-problem-btn-${o.id}`}
                  className="w-full h-10 mt-2 rounded-lg border border-[#723645]/60 text-xs text-neutral-400 flex items-center justify-center gap-1.5 active:bg-[#3D1620]"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Πρόβλημα
                </button>
              )}
            </DriverCard>
          ))}
        </div>
      )}

      {delivered.length > 0 && (
        <div>
          <button
            onClick={() => setShowDelivered((v) => !v)}
            data-testid="fleet-drv-delivered-toggle"
            className="w-full h-12 rounded-lg border border-[#723645]/60 text-sm text-neutral-400 flex items-center justify-center gap-2 active:bg-[#3D1620]"
          >
            Παραδομένες σήμερα 🔵 ({delivered.length})
            <ChevronDown className={`w-4 h-4 transition-transform ${showDelivered ? "rotate-180" : ""}`} />
          </button>
          {showDelivered && (
            <div className="space-y-3 mt-3">
              {delivered.map((o) => (
                <DriverCard key={o.id} o={o} city={city} dim />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          data-testid="fleet-drv-history-toggle"
          className="w-full h-12 rounded-lg border border-[#723645]/60 text-sm text-neutral-400 flex items-center justify-center gap-2 active:bg-[#3D1620]"
        >
          Ιστορικό παραγγελιών
          <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
        </button>
        {showHistory && (
          <div className="mt-3">
            <DriverHistory city={city} />
          </div>
        )}
      </div>
    </section>
  );
}
