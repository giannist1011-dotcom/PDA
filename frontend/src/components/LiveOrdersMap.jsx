import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, RefreshCw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/context/AuthContext";
import { apiLiveMapOrders } from "@/lib/api";
import { eur, formatGRTime } from "@/lib/format";

const POLL_MS = 60000; // auto-refresh κάθε ~60"

// Pin καταστήματος (flame)
const storeIcon = L.divIcon({
  className: "",
  html: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#E8590C" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.6))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34],
});

// Pin παραγγελίας (gold) με τον αριθμό της
const orderIcon = (num) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:34px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="#FFB300" stroke="#2A0E14" stroke-width="1.2" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
      <div style="position:absolute;top:5px;left:0;width:34px;text-align:center;font-family:monospace;font-weight:bold;font-size:10px;color:#2A0E14">${num}</div>
    </div>`,
    iconSize: [34, 40],
    iconAnchor: [17, 34],
  });

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const popupHtml = (o) => `
  <div style="font-family:inherit;min-width:170px;color:#2A0E14">
    <div style="font-weight:bold;font-size:14px;margin-bottom:4px">Παραγγελία #${String(o.order_number).padStart(3, "0")}</div>
    <div style="font-size:12px;color:#555">Ώρα: ${formatGRTime(o.printed_at)}</div>
    ${o.name ? `<div style="font-size:12px;color:#555">${esc(o.name)}</div>` : ""}
    <div style="font-size:12px;color:#555">${esc(o.address)}${o.floor ? ` · Όροφος: ${esc(o.floor)}` : ""}</div>
    <div style="font-weight:bold;color:#B8860B;margin-top:4px">${eur(o.total)}</div>
  </div>`;

export default function LiveOrdersMap() {
  const { user, isOwner } = useAuth();
  const hasStoreLocation = user?.store_lat != null && user?.store_lng != null;

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({}); // order id -> Leaflet marker
  const [orders, setOrders] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(true);

  // Init χάρτη
  useEffect(() => {
    if (!hasStoreLocation || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { attributionControl: false }).setView(
      [user.store_lat, user.store_lng],
      14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    L.marker([user.store_lat, user.store_lng], { icon: storeIcon })
      .addTo(map)
      .bindPopup(`<b>${esc(user?.restaurant_name || "Κατάστημα")}</b>`);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoreLocation]);

  const refresh = async () => {
    try {
      const docs = await apiLiveMapOrders();
      setOrders(docs);
      setLastRefresh(new Date());
    } catch {
      // σιωπηλά — θα ξαναδοκιμάσει στο επόμενο poll
    } finally {
      setLoading(false);
    }
  };

  // Polling
  useEffect(() => {
    if (!hasStoreLocation) {
      setLoading(false);
      return;
    }
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoreLocation]);

  // Συγχρονισμός pins με τις παραγγελίες
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const alive = new Set();
    orders.forEach((o) => {
      if (o.lat == null || o.lng == null) return;
      alive.add(o.id);
      const existing = markersRef.current[o.id];
      if (existing) {
        existing.setLatLng([o.lat, o.lng]);
        existing.setPopupContent(popupHtml(o));
      } else {
        markersRef.current[o.id] = L.marker([o.lat, o.lng], { icon: orderIcon(o.order_number) })
          .addTo(map)
          .bindPopup(popupHtml(o));
      }
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!alive.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
  }, [orders]);

  if (!hasStoreLocation) {
    return (
      <div className="py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg px-6">
        <MapPin className="w-10 h-10 text-flame mx-auto mb-3" />
        <div className="text-white font-bold mb-1">Δεν έχει οριστεί η τοποθεσία του καταστήματος</div>
        <div className="text-sm text-neutral-400">
          {isOwner ? (
            <>
              Ορίστε την τοποθεσία του καταστήματος στις{" "}
              <Link to="/app/settings" className="text-flame underline hover:text-flame/80">
                Ρυθμίσεις
              </Link>{" "}
              για να ενεργοποιηθεί ο χάρτης.
            </>
          ) : (
            "Ζητήστε από τον ιδιοκτήτη να ορίσει την τοποθεσία του καταστήματος στις Ρυθμίσεις."
          )}
        </div>
      </div>
    );
  }

  const pending = orders.filter((o) => o.lat == null || o.lng == null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            Live — παραδόσεις τελευταίων 30 λεπτών
          </span>
          <span className="ml-3 font-mono text-gold font-bold">{orders.length}</span>
          {pending > 0 && (
            <span className="ml-2 text-xs text-neutral-500">
              ({pending} σε αναζήτηση διεύθυνσης...)
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          data-testid="livemap-refresh-btn"
          className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lastRefresh ? `Ανανέωση ${formatGRTime(lastRefresh)}` : "Ανανέωση"}
        </button>
      </div>

      <div
        ref={mapEl}
        data-testid="live-orders-map"
        className="h-[60vh] min-h-[340px] rounded-lg border border-[#723645] overflow-hidden z-0"
      />

      {!loading && orders.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-2">
          Καμία ενεργή παράδοση αυτή τη στιγμή — τα pins εμφανίζονται για 30&#39; μετά την εκτύπωση.
        </div>
      )}
    </div>
  );
}
