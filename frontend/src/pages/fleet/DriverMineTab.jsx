import { useEffect, useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import FleetOrdersMap from "./FleetOrdersMap";
import { DriverCard } from "./DriverCard";
import EmptyState from "@/components/shared/EmptyState";
import DriverHistory from "./DriverHistory";
import { NEXT_ACTION } from "@/components/fleet/utils";

// Ύψος του χάρτη-κεφαλίδας ανοιχτού· κλειστός συρρικνώνεται στο 0
const MAP_H = 224;
// Κατώφλια collapsing header: πόσο πρέπει να κινηθεί το scroll για να μετρήσει
// και από πόσο κάτω αρχίζει να κρύβεται (ώστε να μην «τρεμοπαίζει» στην κορυφή)
const SCROLL_DELTA = 8;
const HIDE_AFTER = 120;

// Collapsing χάρτης: κρύβεται όταν ο οδηγός σκρολάρει προς τα κάτω (θέλει τη
// λίστα) και επανέρχεται στο πρώτο scroll προς τα πάνω. Ένας passive listener
// + rAF — καμία μέτρηση layout ανά frame, οπότε δεν κάνει jank σε μεσαία κινητά.
const useCollapseOnScroll = () => {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        if (Math.abs(dy) >= SCROLL_DELTA) {
          last = y;
          if (dy > 0 && y > HIDE_AFTER) setCollapsed(true);
          else if (dy < 0) setCollapsed(false);
        }
        if (y <= HIDE_AFTER) setCollapsed(false);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return collapsed;
};

// Το tab «Δικές μου» του οδηγού: ΠΑΝΩ-ΠΑΝΩ ο χάρτης με pins στις ενεργές του
// παραγγελίες + στα σημεία παραλαβής (tap σε pin → φωτίζεται η κάρτα), που
// συρρικνώνεται ομαλά στο scroll της λίστας· μετά κάρτες με κουμπί προόδου +
// «Πρόβλημα», παραδομένες σήμερα και ιστορικό. Το state της σελίδας (board,
// busyId, highlight) μένει στο FleetDriver.jsx.
export default function DriverMineTab({
  mine,
  delivered,
  city,
  mapCenter = null,
  busyId,
  onAdvance,
  onProblem,
  highlightId,
  onPinTap,
}) {
  const [showDelivered, setShowDelivered] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const collapsed = useCollapseOnScroll();
  const hasPins = mine.some(
    (o) => (o.lat != null && o.lng != null) || (o.pickup_lat != null && o.pickup_lng != null)
  );

  return (
    <section className="space-y-4">
      {/* Χάρτης-κεφαλίδα: το εξωτερικό div κόβει το ύψος (ο ίδιος ο χάρτης
          κρατά σταθερές διαστάσεις — κανένα invalidateSize/relayout του Leaflet).
          Η πλοήγηση μένει στο «άνοιγμα στο Google Maps» της κάθε κάρτας. */}
      {hasPins && (
        <div
          className="overflow-hidden transition-[height,opacity] duration-300 ease-out will-change-[height]"
          style={{ height: collapsed ? 0 : MAP_H, opacity: collapsed ? 0 : 1 }}
          aria-hidden={collapsed}
          data-testid="fleet-drv-map-header"
        >
          <FleetOrdersMap
            orders={mine}
            defaultCenter={mapCenter}
            heightClass="h-56"
            withPopups={false}
            showPickups
            onPinTap={onPinTap}
            emptyText=""
          />
        </div>
      )}
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
