import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Store } from "lucide-react";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import { apiFleetPartnerStores } from "@/lib/fleetApi";
import StoresMap from "@/pages/fleet/StoresMap";
import EmptyState from "@/components/shared/EmptyState";
import { useAccountCenter } from "@/components/fleet/utils";

const POLL_MS = 30000;

// Κοινή όψη «Μαγαζιά» (χάρτης + λίστα) για διαχειριστή ΚΑΙ διανομέα: μία
// υλοποίηση, ίδια pins/κάρτες. Ο διανομέας τη βλέπει read-only — με
// `showStats={false}` δεν εμφανίζονται πλήθη παραγγελιών (ούτε τα στέλνει το
// backend). Tap σε pin → φωτίζεται η κάρτα· διεύθυνση → Google Maps,
// τηλέφωνο → κλήση.
export default function PartnerStoresView({ showStats = false }) {
  const { team } = useFleet();
  const [stores, setStores] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);
  const mapCenter = useAccountCenter(team?.lat, team?.lng, team?.city);

  const load = useCallback(() => {
    apiFleetPartnerStores()
      .then((d) => setStores(d.stores || []))
      .catch(() => setStores((s) => s || []));
  }, []);

  useEffect(() => {
    load();
    // Ήπιο polling μόνο όπου υπάρχουν ζωντανά νούμερα (διαχειριστής)
    if (!showStats) return undefined;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, showStats]);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const highlight = (id) => {
    setHighlightId(id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 3000);
    document
      .querySelector(`[data-testid="fleet-store-${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const list = stores || [];
  const totalToday = list.reduce((s, x) => s + (x.orders_today || 0), 0);
  const mapsHref = (s) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${s.address}${s.city ? `, ${s.city}` : ""}`
    )}`;

  return (
    <div className="space-y-4">
      {stores !== null && list.length === 0 ? (
        <EmptyState
          text={
            showStats
              ? "Κανένα συνεργαζόμενο μαγαζί ακόμα — τα αιτήματα συνεργασίας εμφανίζονται στον πίνακα"
              : "Η εταιρεία δεν έχει ακόμα συνεργαζόμενα μαγαζιά"
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-500">
              Συνεργαζόμενα μαγαζιά
            </span>
            <span className="font-bold" data-testid="fleet-stores-count">
              {list.length}
            </span>
            {showStats && (
              <span className="ml-auto text-neutral-400">
                Σήμερα: <span className="text-white font-bold">{totalToday}</span>{" "}
                {totalToday === 1 ? "παραγγελία" : "παραγγελίες"}
              </span>
            )}
          </div>

          <StoresMap
            stores={list}
            defaultCenter={mapCenter}
            onPinTap={highlight}
            showStats={showStats}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <div
                key={s.store_user_id}
                data-testid={`fleet-store-${s.store_user_id}`}
                className={`bg-[#3D1620] border rounded-lg p-3 text-sm transition-shadow ${
                  highlightId === s.store_user_id
                    ? "border-flame ring-2 ring-flame"
                    : "border-[#723645]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-flame shrink-0" />
                  <span className="font-bold truncate">{s.name}</span>
                  {showStats && (
                    <span
                      className="ml-auto shrink-0 px-2 py-0.5 rounded-full border border-[#723645] text-xs font-bold text-neutral-300"
                      title="Παραγγελίες που έστειλε σήμερα"
                    >
                      {s.orders_today}
                    </span>
                  )}
                </div>
                {s.address ? (
                  <a
                    href={mapsHref(s)}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`fleet-store-map-${s.store_user_id}`}
                    className="flex items-start gap-1.5 mt-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-flame" />
                    <span>
                      {s.address}
                      {s.city ? `, ${s.city}` : ""}
                    </span>
                  </a>
                ) : (
                  <div className="mt-1.5 text-xs text-neutral-500">
                    Χωρίς διεύθυνση στις ρυθμίσεις του
                  </div>
                )}
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    data-testid={`fleet-store-phone-${s.store_user_id}`}
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-neutral-300 hover:text-white"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0 text-flame" />
                    {s.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showStats && stores !== null && list.length === 0 && (
        <div className="text-sm text-neutral-400">
          Οι συνεργασίες ξεκινούν από τα μαγαζιά και εγκρίνονται στον{" "}
          <Link to="/fleet" className="text-flame font-semibold hover:underline">
            πίνακα παραγγελιών
          </Link>
          .
        </div>
      )}
    </div>
  );
}
