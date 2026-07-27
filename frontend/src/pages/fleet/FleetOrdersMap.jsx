import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META, minutesSince } from "./utils";

// Χάρτης παραγγελιών FleetDeck (Leaflet, όπως ο LiveOrdersMap του POS).
// Τα pins είναι ΔΙΕΥΘΥΝΣΕΙΣ ΠΑΡΑΓΓΕΛΙΩΝ — ποτέ θέσεις οδηγών. Χρώμα ανά
// κατάσταση (🔴🟡🟢), ⚡ επείγουσες με χρυσό δαχτυλίδι + κεραυνό. Παραγγελίες
// χωρίς συντεταγμένες απλώς δεν εμφανίζονται (μικρή ένδειξη από κάτω).
// Ανανεώνεται με το polling της σελίδας που τον φιλοξενεί — κανένα δικό του poll.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const pinIcon = (o) => {
  const color = (STATUS_META[o.status] || STATUS_META.waiting).dot;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:34px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="${o.urgent ? "#FFC300" : "#2A0E14"}" stroke-width="${o.urgent ? 2.2 : 1.2}" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
      <div style="position:absolute;top:5px;left:0;width:34px;text-align:center;font-family:monospace;font-weight:bold;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)">${esc(o.number)}</div>
      ${o.urgent ? `<div style="position:absolute;top:-8px;right:-3px;font-size:13px">⚡</div>` : ""}
    </div>`,
    iconSize: [34, 40],
    iconAnchor: [17, 34],
  });
};

// Popup = η κάρτα της παραγγελίας: αριθμός, κατάστημα, διεύθυνση, οδηγός, ⏱ λεπτά
const popupHtml = (o) => {
  const meta = STATUS_META[o.status] || STATUS_META.waiting;
  const mins = minutesSince(o.created_at);
  return `
  <div style="font-family:inherit;min-width:180px;color:#2A0E14">
    <div style="font-weight:bold;font-size:14px;margin-bottom:4px">${o.urgent ? "⚡ " : ""}#${esc(o.number)} · ${meta.emoji} ${esc(meta.label)}</div>
    <div style="font-size:12px;color:#555">${esc(o.pickup_name)}</div>
    <div style="font-size:12px;color:#555">${esc(o.address)}</div>
    <div style="font-size:12px;color:#555">🛵 ${esc(o.driver_name || "—")}</div>
    ${mins != null ? `<div style="font-weight:bold;color:#B8860B;margin-top:4px">⏱ ${mins}'</div>` : ""}
  </div>`;
};

export default function FleetOrdersMap({
  orders,
  // Default κέντρο χωρίς παραγγελίες: το pin/πόλη του λογαριασμού ({lat, lng}) —
  // null → θέα Ελλάδας. Μπορεί να έρθει καθυστερημένα (async geocode πόλης).
  defaultCenter = null,
  heightClass = "h-[55vh] min-h-[320px]",
  withPopups = true,
  onPinTap = null,
  emptyText = "Καμία ενεργή παραγγελία με pin στον χάρτη",
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({}); // order id -> Leaflet marker
  const fittedRef = useRef(false);
  // Σταθερό handler για τα click listeners των markers (δεν ξαναδένονται ανά poll)
  const onPinTapRef = useRef(onPinTap);
  onPinTapRef.current = onPinTap;

  const located = orders.filter((o) => o.lat != null && o.lng != null);
  const unlocated = orders.length - located.length;

  // Init χάρτη — αρχική θέα το pin του λογαριασμού (αλλιώς Ελλάδα) μέχρι το
  // πρώτο fitBounds στα pins παραγγελιών
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { attributionControl: false }).setView(
      defaultCenter ? [defaultCenter.lat, defaultCenter.lng] : [38.3, 23.8],
      defaultCenter ? 13 : 6
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Το defaultCenter μπορεί να έρθει ΜΕΤΑ το init (async geocode της πόλης) —
  // κεντράρισμα μόνο όσο ο χάρτης δεν έχει κάνει fit σε pins παραγγελιών
  useEffect(() => {
    if (defaultCenter && mapRef.current && !fittedRef.current) {
      mapRef.current.setView([defaultCenter.lat, defaultCenter.lng], 13);
    }
  }, [defaultCenter]);

  // Συγχρονισμός pins με τις παραγγελίες (ίδιο μοτίβο με LiveOrdersMap):
  // ενημέρωση υπαρχόντων, προσθήκη νέων, αφαίρεση όσων έφυγαν (🔵/ακύρωση)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const alive = new Set();
    located.forEach((o) => {
      alive.add(o.id);
      const existing = markersRef.current[o.id];
      if (existing) {
        existing.setLatLng([o.lat, o.lng]);
        existing.setIcon(pinIcon(o));
        if (withPopups) existing.setPopupContent(popupHtml(o));
      } else {
        const m = L.marker([o.lat, o.lng], { icon: pinIcon(o) }).addTo(map);
        if (withPopups) m.bindPopup(popupHtml(o));
        m.on("click", () => onPinTapRef.current?.(o.id));
        markersRef.current[o.id] = m;
      }
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!alive.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
    if (!fittedRef.current && located.length) {
      map.fitBounds(L.latLngBounds(located.map((o) => [o.lat, o.lng])).pad(0.25), { maxZoom: 15 });
      fittedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, withPopups]);

  return (
    <div className="space-y-2">
      <div
        ref={mapEl}
        data-testid="fleet-orders-map"
        className={`${heightClass} rounded-lg border border-[#723645] overflow-hidden z-0`}
      />
      {located.length === 0 && emptyText && (
        <div className="text-sm text-neutral-500 text-center">{emptyText}</div>
      )}
      {unlocated > 0 && (
        <div className="text-xs text-neutral-500 text-center" data-testid="fleet-map-unlocated">
          {unlocated === 1 ? "1 παραγγελία" : `${unlocated} παραγγελίες`} χωρίς pin — η διεύθυνση
          δεν έχει συντεταγμένες (επιλέξτε πρόταση στην επεξεργασία για να εμφανιστεί)
        </div>
      )}
    </div>
  );
}
