import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { addBaseLayer } from "@/components/shared/mapPin";

// Χάρτης συνεργαζόμενων μαγαζιών (Leaflet, ίδιο στυλ με τους υπόλοιπους χάρτες
// του FleetDeck). Ένα pin ανά μαγαζί από το pin των ρυθμίσεών του· tap →
// popup με όνομα, διεύθυνση, τηλέφωνο (tap-to-call) και πλήθος παραγγελιών
// σήμερα. Μαγαζιά χωρίς pin απλώς δεν εμφανίζονται (φαίνονται στη λίστα).

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const storeIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">
      <svg width="30" height="36" viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 28 4 18h16Z" fill="#E8590C"/>
        <rect x="2" y="2" width="20" height="17" rx="3" fill="#E8590C" stroke="#fff" stroke-width="1.2"/>
        <path d="M7 15v-5h10v5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M5 9.5 12 5l7 4.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
  iconSize: [30, 36],
  iconAnchor: [15, 34],
});

const popupHtml = (s) => `
  <div style="font-family:inherit;min-width:170px;color:#2A0E14">
    <div style="font-weight:bold;font-size:14px;margin-bottom:4px">${esc(s.name)}</div>
    ${s.address ? `<div style="font-size:12px;color:#555">${esc(s.address)}${s.city ? `, ${esc(s.city)}` : ""}</div>` : ""}
    ${s.phone ? `<a href="tel:${esc(s.phone)}" style="display:inline-block;margin-top:4px;font-weight:bold;color:#B8860B">📞 ${esc(s.phone)}</a>` : ""}
    <div style="font-weight:bold;margin-top:4px">Σήμερα: ${s.orders_today} ${s.orders_today === 1 ? "παραγγελία" : "παραγγελίες"}</div>
  </div>`;

export default function StoresMap({ stores, defaultCenter = null, onPinTap = null }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const fittedRef = useRef(false);
  const onPinTapRef = useRef(onPinTap);
  onPinTapRef.current = onPinTap;

  const located = stores.filter((s) => s.lat != null && s.lng != null);
  const unlocated = stores.length - located.length;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const map = addBaseLayer(
      L.map(mapEl.current, { attributionControl: false }).setView(
        defaultCenter ? [defaultCenter.lat, defaultCenter.lng] : [38.3, 23.8],
        defaultCenter ? 12 : 6
      )
    );
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Το defaultCenter μπορεί να έρθει μετά το init (async geocode πόλης)
  useEffect(() => {
    if (defaultCenter && mapRef.current && !fittedRef.current) {
      mapRef.current.setView([defaultCenter.lat, defaultCenter.lng], 12);
    }
  }, [defaultCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const alive = new Set();
    located.forEach((s) => {
      alive.add(s.store_user_id);
      const existing = markersRef.current[s.store_user_id];
      if (existing) {
        existing.setLatLng([s.lat, s.lng]);
        existing.setPopupContent(popupHtml(s));
      } else {
        const m = L.marker([s.lat, s.lng], { icon: storeIcon }).addTo(map);
        m.bindPopup(popupHtml(s));
        m.on("click", () => onPinTapRef.current?.(s.store_user_id));
        markersRef.current[s.store_user_id] = m;
      }
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!alive.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
    if (!fittedRef.current && located.length) {
      map.fitBounds(L.latLngBounds(located.map((s) => [s.lat, s.lng])).pad(0.25), { maxZoom: 15 });
      fittedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  return (
    <div className="space-y-2">
      <div
        ref={mapEl}
        data-testid="fleet-stores-map"
        className="h-[45vh] min-h-[280px] rounded-lg border border-[#723645] overflow-hidden z-0"
      />
      {located.length === 0 && (
        <div className="text-sm text-neutral-500 text-center">
          Κανένα συνεργαζόμενο μαγαζί με pin στον χάρτη
        </div>
      )}
      {unlocated > 0 && (
        <div className="text-xs text-neutral-500 text-center" data-testid="fleet-stores-unlocated">
          {unlocated === 1 ? "1 μαγαζί" : `${unlocated} μαγαζιά`} χωρίς pin — δεν έχουν ορίσει
          τοποθεσία στις ρυθμίσεις τους
        </div>
      )}
    </div>
  );
}
