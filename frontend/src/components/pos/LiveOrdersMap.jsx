import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eraser, MapPin, MapPinOff, RefreshCw } from "lucide-react";
import L from "leaflet";
import MapCanvas from "@/components/shared/map/MapCanvas";
import { dropPin, esc, popupHtml, syncMarkers } from "@/components/shared/map/pins";
import { useAuth } from "@/context/shared/AuthContext";
import { apiClearLiveMap, apiLiveMapOrders } from "@/lib/api";
import { eur, formatGRTime } from "@/lib/format";

const POLL_MS = 60000; // auto-refresh κάθε ~60"

// Pin καταστήματος (flame) — ίδια σταγόνα με τα pins των φορμών
const storeIcon = dropPin({ fill: "#E8590C", stroke: "#fff", strokeWidth: 1.5, size: 36, dot: true });

// Pin παραγγελίας (gold) με τον αριθμό της
const orderIcon = (o) =>
  dropPin({
    fill: "#FFB300",
    label: String(o.order_number),
    labelColor: "#2A0E14",
  });

const orderPopup = (o) =>
  popupHtml({
    title: `Παραγγελία #${String(o.order_number).padStart(3, "0")}`,
    lines: [
      `Ώρα: ${formatGRTime(o.printed_at)}`,
      o.name ? esc(o.name) : null,
      `${esc(o.address)}${o.floor ? ` · Όροφος: ${esc(o.floor)}` : ""}`,
    ],
    accent: eur(o.total),
  });

export default function LiveOrdersMap() {
  const { user, isOwner } = useAuth();
  const hasStoreLocation = user?.store_lat != null && user?.store_lng != null;

  const [map, setMap] = useState(null);
  const markersRef = useRef({}); // order id -> Leaflet marker
  const [orders, setOrders] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const clearMap = async () => {
    if (!window.confirm("Καθαρισμός όλων των παραγγελιών από τον χάρτη;")) return;
    setClearing(true);
    try {
      await apiClearLiveMap();
      setOrders([]);
      setLastRefresh(new Date());
    } catch {
      // σιωπηλά — το επόμενο poll θα δείξει την πραγματική κατάσταση
    } finally {
      setClearing(false);
    }
  };

  // Pin καταστήματος — μπαίνει μόλις είναι έτοιμος ο χάρτης
  useEffect(() => {
    if (!map) return;
    L.marker([user.store_lat, user.store_lng], { icon: storeIcon })
      .addTo(map)
      .bindPopup(`<b>${esc(user?.restaurant_name || "Κατάστημα")}</b>`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

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
    if (!map) return;
    syncMarkers(
      map,
      markersRef.current,
      orders.filter((o) => o.lat != null && o.lng != null),
      {
        key: (o) => o.id,
        latlng: (o) => [o.lat, o.lng],
        icon: orderIcon,
        popup: orderPopup,
      }
    );
  }, [map, orders]);

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

  const pending = orders.filter(
    (o) => (o.lat == null || o.lng == null) && o.geo_status !== "failed"
  ).length;
  const unlocated = orders.filter((o) => o.geo_status === "failed");

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
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            data-testid="livemap-refresh-btn"
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {lastRefresh ? `Ανανέωση ${formatGRTime(lastRefresh)}` : "Ανανέωση"}
          </button>
          <button
            onClick={clearMap}
            disabled={clearing || orders.length === 0}
            data-testid="livemap-clear-btn"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#723645] text-neutral-300 hover:text-white hover:border-flame transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Eraser className="w-3.5 h-3.5" />
            Καθαρισμός χάρτη
          </button>
        </div>
      </div>

      <MapCanvas
        testId="live-orders-map"
        heightClass="h-[60vh] min-h-[340px]"
        center={{ lat: user.store_lat, lng: user.store_lng }}
        zoom={14}
        onReady={setMap}
        notes={[
          !loading && orders.length === 0
            ? "Καμία ενεργή παράδοση αυτή τη στιγμή — τα pins εμφανίζονται για 30΄ μετά την εκτύπωση."
            : null,
        ]}
      />

      {unlocated.length > 0 && (
        <div
          data-testid="livemap-unlocated"
          className="bg-[#3D1620] border border-[#723645] rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <MapPinOff className="w-4 h-4 text-gold" />
            Χωρίς τοποθεσία ({unlocated.length})
            <span className="text-xs font-normal text-neutral-500">
              — η διεύθυνση δεν βρέθηκε στον χάρτη
            </span>
          </div>
          <div className="space-y-1.5">
            {unlocated.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 text-sm bg-[#2A0E14] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-mono font-bold text-gold">
                    #{String(o.order_number).padStart(3, "0")}
                  </span>
                  <span className="ml-2 text-neutral-400 text-xs">
                    {formatGRTime(o.printed_at)}
                  </span>
                  {o.name && <span className="ml-2 text-neutral-300">{o.name}</span>}
                  <div className="text-xs text-neutral-500 truncate">
                    {o.address}
                    {o.floor ? ` · Όροφος: ${o.floor}` : ""}
                  </div>
                </div>
                <div className="font-bold text-gold whitespace-nowrap">{eur(o.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
