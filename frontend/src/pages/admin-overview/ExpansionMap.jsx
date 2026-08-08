import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Map as MapIcon } from "lucide-react";
import MapCanvas from "@/components/shared/map/MapCanvas";
import { bubblePin, esc, fitToPoints, popupHtml } from "@/components/shared/map/pins";
import { PLAN_LABELS } from "./utils";

// Ο χάρτης επέκτασης (centerpiece): ένα marker ανά πόλη με παρουσία
// OrderDeck/FleetDeck, στον ίδιο καμβά/tiles/popups με τους χάρτες των δύο
// εφαρμογών (components/shared/map). Μέγεθος/χρώμα ~ ενεργοί πληρωτικοί
// λογαριασμοί, γκρι οι demo-only πόλεις. Οι συντεταγμένες έρχονται έτοιμες από
// το backend (cached ανά πόλη) — καμία γεωκωδικοποίηση στο frontend.

const markerSize = (paying) => Math.min(52, 26 + paying * 3);

const cityIcon = (c) => {
  const demoOnly = c.paying === 0 && c.companies === 0;
  return bubblePin({
    size: demoOnly ? 24 : markerSize(c.paying + c.companies),
    background: demoOnly ? "#6B7280" : "radial-gradient(circle at 32% 30%, #F97316, #B91C1C 78%)",
    label: demoOnly ? "d" : c.paying + c.companies,
    muted: demoOnly,
  });
};

// Popup: μαγαζιά ανά πλάνο + εταιρίες, με τα demo ξεχωριστά (εκτός headline)
const cityPopup = (c) => {
  const plans = Object.entries(c.stores || {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${esc(PLAN_LABELS[k] || k)}: <b>${n}</b>`);
  return popupHtml({
    title: `📍 ${esc(c.name)}`,
    lines: [
      ...(plans.length ? plans : ["Κανένα ενεργό μαγαζί"]),
      c.companies > 0 ? `Εταιρίες delivery: <b>${c.companies}</b>` : null,
      c.demo > 0 ? `<span style="color:#888">Demo λογαριασμοί: ${c.demo}</span>` : null,
    ],
  });
};

export default function ExpansionMap({ cities, geocodingPending }) {
  const [map, setMap] = useState(null);
  const layerRef = useRef(null);

  const located = (cities || []).filter((c) => c.lat != null && c.lng != null);

  useEffect(() => {
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = L.layerGroup(
      located.map((c) => L.marker([c.lat, c.lng], { icon: cityIcon(c) }).bindPopup(cityPopup(c)))
    ).addTo(map);
    fitToPoints(
      map,
      located.map((c) => [c.lat, c.lng]),
      { maxZoom: 9, pad: 0.3, once: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cities]);

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400">
          <MapIcon className="w-4 h-4 text-flame" /> Χάρτης επέκτασης
        </div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-flame inline-block" /> ενεργοί λογαριασμοί
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-neutral-500 inline-block" /> μόνο demo
          </span>
        </div>
      </div>
      <MapCanvas
        testId="expansion-map"
        heightClass="h-[60vh] min-h-[380px]"
        onReady={setMap}
        notes={[
          located.length === 0
            ? "Καμία πόλη με συντεταγμένες ακόμα — θα εμφανιστούν μόλις γεωκωδικοποιηθούν."
            : null,
          geocodingPending > 0
            ? {
                small: true,
                testId: "map-geocoding",
                text: `${
                  geocodingPending === 1
                    ? "1 πόλη γεωκωδικοποιείται στο παρασκήνιο"
                    : `${geocodingPending} πόλεις γεωκωδικοποιούνται στο παρασκήνιο`
                } — ανανεώστε σε λίγο για να εμφανιστούν.`,
              }
            : null,
        ]}
      />
    </div>
  );
}
