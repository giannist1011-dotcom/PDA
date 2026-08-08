import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, MapPin, RefreshCcw } from "lucide-react";
import L from "leaflet";
import "leaflet.heat";
import MapCanvas from "@/components/shared/map/MapCanvas";
import { useAuth } from "@/context/shared/AuthContext";
import { apiOrdersHeatmap } from "@/lib/api";
import { presetRange } from "@/lib/dates";
import { businessToday } from "@/lib/businessDay";
import PeriodFilter, { periodLabel } from "@/components/shared/PeriodFilter";
import { Button } from "@/components/ui/button";

// ---------- Heatmap διευθύνσεων παράδοσης (Στατιστικά) ----------
// Χρησιμοποιεί τις ήδη γεωκωδικοποιημένες διευθύνσεις (geocode cache του live
// χάρτη) — παραγγελίες χωρίς αποθηκευμένες συντεταγμένες δεν εμφανίζονται.
export default function AddressHeatmap() {
  const { user, isOwner } = useAuth();
  const hasStoreLocation = user?.store_lat != null && user?.store_lng != null;

  const bizToday = businessToday(user);
  const [period, setPeriod] = useState(() => {
    const r = presetRange("last7", businessToday(user));
    return { preset: "last7", from: r.from, to: r.to };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [map, setMap] = useState(null);
  const heatRef = useRef(null);

  const load = async (f = period.from, t = period.to) => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiOrdersHeatmap(f || bizToday, t || bizToday));
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

  // Σημείο καταστήματος στον χάρτη — μόλις είναι έτοιμος ο καμβάς
  useEffect(() => {
    if (!map) return;
    L.circleMarker([user.store_lat, user.store_lng], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#E8590C",
      fillOpacity: 1,
    }).addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Συγχρονισμός heat layer με τα σημεία
  useEffect(() => {
    if (!map) {
      heatRef.current = null;
      return;
    }
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
  }, [map, data]);

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
          today={bizToday}
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

      <MapCanvas
        testId="address-heatmap"
        heightClass="h-[50vh] min-h-[300px]"
        center={{ lat: user.store_lat, lng: user.store_lng }}
        onReady={setMap}
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
