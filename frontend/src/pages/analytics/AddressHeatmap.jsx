import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, MapPin, RefreshCcw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { useAuth } from "@/context/AuthContext";
import { apiOrdersHeatmap } from "@/lib/api";
import { athensToday, presetRange } from "@/lib/dates";
import PeriodFilter, { periodLabel } from "@/components/PeriodFilter";
import { Button } from "@/components/ui/button";

// ---------- Heatmap διευθύνσεων παράδοσης (Στατιστικά) ----------
// Χρησιμοποιεί τις ήδη γεωκωδικοποιημένες διευθύνσεις (geocode cache του live
// χάρτη) — παραγγελίες χωρίς αποθηκευμένες συντεταγμένες δεν εμφανίζονται.
export default function AddressHeatmap() {
  const { user, isOwner } = useAuth();
  const hasStoreLocation = user?.store_lat != null && user?.store_lng != null;

  const [period, setPeriod] = useState(() => {
    const r = presetRange("last7");
    return { preset: "last7", from: r.from, to: r.to };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const heatRef = useRef(null);

  const load = async (f = period.from, t = period.to) => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiOrdersHeatmap(f || athensToday(), t || athensToday()));
    } catch {
      setError("Σφάλμα φόρτωσης heatmap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasStoreLocation) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoreLocation]);

  const handlePeriodChange = (next, meta) => {
    setPeriod(next);
    if (meta.fromPreset) load(next.from, next.to);
  };

  // Init χάρτη
  useEffect(() => {
    if (!hasStoreLocation || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { attributionControl: false }).setView(
      [user.store_lat, user.store_lng],
      13
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    L.circleMarker([user.store_lat, user.store_lng], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#E8590C",
      fillOpacity: 1,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoreLocation]);

  // Συγχρονισμός heat layer με τα σημεία
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    const points = data?.points || [];
    if (points.length === 0) return;
    const maxCount = Math.max(...points.map((p) => p.count));
    heatRef.current = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.count]),
      { radius: 28, blur: 18, max: maxCount, maxZoom: 17 }
    ).addTo(map);
  }, [data]);

  if (!hasStoreLocation) {
    return (
      <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-flame" />
          <h3 className="font-heading text-lg font-bold">Heatmap διευθύνσεων</h3>
        </div>
        <div className="py-8 text-center text-sm text-neutral-400">
          <MapPin className="w-8 h-8 text-flame mx-auto mb-2" />
          {isOwner ? (
            <>
              Ορίστε την τοποθεσία του καταστήματος στις{" "}
              <Link to="/app/settings" className="text-flame underline hover:text-flame/80">
                Ρυθμίσεις
              </Link>{" "}
              για να ενεργοποιηθεί το heatmap.
            </>
          ) : (
            "Δεν έχει οριστεί η τοποθεσία του καταστήματος."
          )}
        </div>
      </div>
    );
  }

  const unlocated = data ? data.total_delivery_orders - data.located : 0;

  return (
    <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-5 h-5 text-flame" />
        <h3 className="font-heading text-lg font-bold">Heatmap διευθύνσεων</h3>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Πυκνότητα παραδόσεων ανά περιοχή για την επιλεγμένη περίοδο.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-3">
        <PeriodFilter
          value={period}
          onChange={handlePeriodChange}
          testIdPrefix="heatmap"
          pickerClassName="h-9 px-2"
        />
        <Button
          onClick={() => load()}
          disabled={loading}
          data-testid="heatmap-apply-btn"
          className="h-9 px-4 bg-brand hover:bg-brand-hover text-white font-bold"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          {loading ? "Φόρτωση..." : "Εφαρμογή"}
        </Button>
      </div>

      {error && <div className="text-sm text-[#FF6961] mb-3">{error}</div>}

      <div
        ref={mapEl}
        data-testid="address-heatmap"
        className="h-[50vh] min-h-[300px] rounded-lg border border-[#723645] overflow-hidden z-0"
      />

      <div className="text-xs text-neutral-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Εύρος: <span className="font-mono text-neutral-400">{periodLabel(period)}</span>
        </span>
        {data && (
          <span data-testid="heatmap-meta">
            {data.total_delivery_orders} παραδόσεις ·{" "}
            <span className="text-neutral-400 font-bold">{data.located}</span> στον χάρτη
            {unlocated > 0 && ` · ${unlocated} χωρίς αποθηκευμένες συντεταγμένες`}
          </span>
        )}
        {data && data.points.length === 0 && !loading && (
          <span className="text-neutral-400">Καμία παράδοση με συντεταγμένες στην περίοδο.</span>
        )}
      </div>
    </div>
  );
}
