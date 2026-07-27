import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon } from "lucide-react";
import { PLAN_LABELS } from "./utils";

// Ο χάρτης επέκτασης (centerpiece): ένα marker ανά πόλη με παρουσία
// OrderDeck/FleetDeck. Μέγεθος/χρώμα ~ ενεργοί πληρωτικοί λογαριασμοί,
// γκρι οι demo-only πόλεις. Οι συντεταγμένες έρχονται έτοιμες από το backend
// (cached ανά πόλη) — καμία γεωκωδικοποίηση στο frontend.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const markerSize = (paying) => Math.min(52, 26 + paying * 3);

const cityIcon = (c) => {
  const demoOnly = c.paying === 0 && c.companies === 0;
  const size = demoOnly ? 24 : markerSize(c.paying + c.companies);
  const bg = demoOnly
    ? "#6B7280"
    : "radial-gradient(circle at 32% 30%, #F97316, #B91C1C 78%)";
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};
      border:2px solid #2A0E14;box-shadow:0 2px 6px rgba(0,0,0,.55);display:flex;
      align-items:center;justify-content:center;color:#fff;font-weight:bold;
      font-family:monospace;font-size:${Math.max(11, size / 3)}px">
      ${demoOnly ? "d" : c.paying + c.companies}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Popup: μαγαζιά ανά πλάνο + εταιρίες, με τα demo ξεχωριστά (εκτός headline)
const popupHtml = (c) => {
  const plans = Object.entries(c.stores || {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<div style="font-size:12px;color:#555">${esc(PLAN_LABELS[k] || k)}: <b>${n}</b></div>`)
    .join("");
  return `
  <div style="font-family:inherit;min-width:170px;color:#2A0E14">
    <div style="font-weight:bold;font-size:14px;margin-bottom:4px">📍 ${esc(c.name)}</div>
    ${plans || `<div style="font-size:12px;color:#555">Κανένα ενεργό μαγαζί</div>`}
    ${c.companies > 0 ? `<div style="font-size:12px;color:#555">Εταιρίες delivery: <b>${c.companies}</b></div>` : ""}
    ${c.demo > 0 ? `<div style="font-size:12px;color:#888;margin-top:4px">Demo λογαριασμοί: ${c.demo}</div>` : ""}
  </div>`;
};

export default function ExpansionMap({ cities, geocodingPending }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { attributionControl: false }).setView([38.3, 23.8], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  const located = (cities || []).filter((c) => c.lat != null && c.lng != null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const layer = L.layerGroup(
      located.map((c) =>
        L.marker([c.lat, c.lng], { icon: cityIcon(c) }).bindPopup(popupHtml(c))
      )
    ).addTo(map);
    layerRef.current = layer;
    if (located.length) {
      map.fitBounds(L.latLngBounds(located.map((c) => [c.lat, c.lng])).pad(0.3), {
        maxZoom: 9,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

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
      <div
        ref={mapEl}
        data-testid="expansion-map"
        className="h-[60vh] min-h-[380px] rounded-lg border border-[#723645] overflow-hidden z-0"
      />
      {located.length === 0 && (
        <div className="text-sm text-neutral-500 text-center">
          Καμία πόλη με συντεταγμένες ακόμα — θα εμφανιστούν μόλις γεωκωδικοποιηθούν.
        </div>
      )}
      {geocodingPending > 0 && (
        <div className="text-xs text-neutral-500 text-center" data-testid="map-geocoding">
          {geocodingPending === 1
            ? "1 πόλη γεωκωδικοποιείται στο παρασκήνιο"
            : `${geocodingPending} πόλεις γεωκωδικοποιούνται στο παρασκήνιο`}{" "}
          — ανανεώστε σε λίγο για να εμφανιστούν.
        </div>
      )}
    </div>
  );
}
