import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GREECE_VIEW, MAP_BOX, addBaseLayer, hasFitted } from "./pins";

// ---------------------------------------------------------------------------
// Το ΕΝΑ καμβάς-component κάθε χάρτη προβολής (live χάρτης OrderDeck, χάρτης
// διαχειριστή & οδηγού FleetDeck, Μαγαζιά, χάρτης επέκτασης admin, heatmap):
// ίδιο κουτί, ίδια tiles, ίδια zoom controls, ίδιες σημειώσεις από κάτω.
//
// Ο γονιός παίρνει το Leaflet map μέσω `onReady(map)` (και `onReady(null)` στο
// unmount) — το κρατάει σε state και προσθέτει τα δικά του markers/layers με
// τα helpers του pins.js.
// ---------------------------------------------------------------------------
export default function MapCanvas({
  testId,
  heightClass = "h-[55vh] min-h-[320px]",
  // {lat, lng} — μπορεί να έρθει και καθυστερημένα (async geocode πόλης)
  center = null,
  zoom = 13,
  onReady,
  // Κεντραρισμένες γραμμές κάτω από τον χάρτη (empty state, «χωρίς pin», κ.λπ.)
  notes = [],
}) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const initialRef = useRef({ center, zoom });

  useEffect(() => {
    if (!el.current || mapRef.current) return undefined;
    const { center: c0, zoom: z0 } = initialRef.current;
    const map = addBaseLayer(
      L.map(el.current, { attributionControl: false }).setView(
        c0 ? [c0.lat, c0.lng] : [GREECE_VIEW.lat, GREECE_VIEW.lng],
        c0 ? z0 : GREECE_VIEW.zoom
      )
    );
    mapRef.current = map;
    onReadyRef.current?.(map);
    return () => {
      onReadyRef.current?.(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Το κέντρο μπορεί να έρθει ΜΕΤΑ το init — κεντράρισμα μόνο όσο ο χάρτης δεν
  // έχει ήδη προσαρμοστεί σε pins (fitToPoints)
  useEffect(() => {
    if (center && mapRef.current && !hasFitted(mapRef.current)) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng]);

  // Κάθε σημείωση: string ή {text, testId, small}
  const lines = notes.filter(Boolean).map((n) => (typeof n === "object" ? n : { text: n }));

  return (
    <div className="space-y-2">
      <div ref={el} data-testid={testId} className={`${heightClass} ${MAP_BOX}`} />
      {lines.map((n, i) => (
        <div
          key={n.testId || i}
          data-testid={n.testId}
          className={`${n.small ? "text-xs" : "text-sm"} text-neutral-500 text-center`}
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}
