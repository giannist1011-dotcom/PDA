import { useEffect, useState } from "react";
import FleetOrdersMap from "./FleetOrdersMap";

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

// Ο χάρτης-κεφαλίδα της ΣΕΛΙΔΑΣ του διανομέα: μπαίνει πάνω-πάνω, πάνω από τα
// tabs, και αλλάζει περιεχόμενο με το ενεργό tab — «Ελεύθερες» τα διαθέσιμα
// προς claim, «Οι παραγγελίες μου» τα δικά του ενεργά (+ σημεία παραλαβής).
// Tap σε pin → φωτίζεται και σκρολάρει σε θέα η αντίστοιχη κάρτα. Το εξωτερικό
// div κόβει μόνο το ύψος: ο ίδιος ο χάρτης κρατά σταθερές διαστάσεις, οπότε δεν
// χρειάζεται invalidateSize/relayout του Leaflet σε κάθε frame.
export default function DriverMapHeader({ orders, mapCenter = null, onPinTap }) {
  const collapsed = useCollapseOnScroll();
  const hasPins = orders.some(
    (o) => (o.lat != null && o.lng != null) || (o.pickup_lat != null && o.pickup_lng != null)
  );
  if (!hasPins) return null;

  return (
    <div
      className="overflow-hidden transition-[height,opacity] duration-300 ease-out will-change-[height]"
      style={{ height: collapsed ? 0 : MAP_H, opacity: collapsed ? 0 : 1 }}
      aria-hidden={collapsed}
      data-testid="fleet-drv-map-header"
    >
      <FleetOrdersMap
        orders={orders}
        defaultCenter={mapCenter}
        heightClass="h-56"
        withPopups={false}
        showPickups
        onPinTap={onPinTap}
        emptyText=""
      />
    </div>
  );
}
