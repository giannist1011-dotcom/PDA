import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Search, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress, geocodeCityCenter, formatApiError } from "@/lib/api";

// Κοινός πυρήνας «Στοιχεία επιχείρησης»: όνομα, τηλέφωνο/α, πόλη, διεύθυνση με
// «Εύρεση στον χάρτη» + pin picker (Leaflet). Τον χρησιμοποιούν οι ρυθμίσεις
// καταστήματος (StoreDetailsSettings, με έξτρα πεδία στα slots) και οι ρυθμίσεις
// εταιρείας FleetDeck. Χωρίς pin ο χάρτης κεντράρει στην αποθηκευμένη πόλη
// (geocode) — τελικό fallback η Ελλάδα.

const GREECE_CENTER = [38.3, 23.8];
const GREECE_ZOOM = 6;

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#E8590C" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.6))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

const inputCls =
  "w-full h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] focus:border-flame outline-none text-sm";

export default function BusinessDetailsForm({
  // Αρχικές τιμές: {name, phone, address, city, lat, lng}
  initial = {},
  nameLabel = "Όνομα καταστήματος",
  cityLabel = "Πόλη / Περιοχή",
  mapLabel = "Τοποθεσία — πατήστε στον χάρτη για να βάλετε pin",
  // Slot δίπλα στην πόλη (π.χ. ζώνη διανομής) + έξτρα sections πριν την αποθήκευση.
  // Τα slots παίρνουν το δικό τους state στον γονιό — το onSave τα συγχωνεύει εκεί.
  besideCity = null,
  children = null,
  // async ({name, phone, address, city, lat, lng}) — API κλήση + success toast στον γονιό
  onSave,
  testPrefix = "store",
}) {
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [address, setAddress] = useState(initial.address || "");
  const [city, setCity] = useState(initial.city || "");
  const [latlng, setLatlng] = useState(
    initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null
  );
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const hasPinRef = useRef(!!latlng);
  hasPinRef.current = !!latlng;

  const placePin = (lat, lng, pan = true) => {
    setLatlng({ lat, lng });
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 16));
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const start = latlng ? [latlng.lat, latlng.lng] : GREECE_CENTER;
    const map = L.map(mapEl.current, { attributionControl: false }).setView(
      start,
      latlng ? 16 : GREECE_ZOOM
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    map.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng, false));
    mapRef.current = map;
    if (latlng) {
      markerRef.current = L.marker([latlng.lat, latlng.lng], { icon: pinIcon }).addTo(map);
    } else if ((initial.city || "").trim()) {
      // Χωρίς pin: κεντράρισμα στην αποθηκευμένη πόλη (αν βρεθεί)
      geocodeCityCenter(initial.city).then((c) => {
        if (c && mapRef.current && !hasPinRef.current) {
          mapRef.current.setView([c.lat, c.lng], 12);
        }
      });
    }
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findFromAddress = async () => {
    if (!address.trim()) {
      toast.error("Γράψτε πρώτα τη διεύθυνση");
      return;
    }
    setGeocoding(true);
    try {
      const q = city.trim() ? `${address.trim()}, ${city.trim()}` : address.trim();
      const results = await geocodeAddress(q);
      if (results?.length) {
        placePin(parseFloat(results[0].lat), parseFloat(results[0].lon));
        toast.success("Η διεύθυνση βρέθηκε — ελέγξτε το pin στον χάρτη");
      } else {
        toast.error("Δεν βρέθηκε η διεύθυνση — βάλτε το pin χειροκίνητα στον χάρτη");
      }
    } catch {
      toast.error("Αποτυχία αναζήτησης — βάλτε το pin χειροκίνητα στον χάρτη");
    } finally {
      setGeocoding(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error(`Το πεδίο «${nameLabel}» είναι υποχρεωτικό`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        lat: latlng?.lat ?? null,
        lng: latlng?.lng ?? null,
      });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">{nameLabel}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            data-testid={`${testPrefix}-name-input`}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">Τηλέφωνο/α</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={60}
            placeholder="π.χ. 210 1234567, 69X XXXXXXX"
            data-testid={`${testPrefix}-phone-input`}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">{cityLabel}</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            placeholder="π.χ. Κοζάνη"
            data-testid={`${testPrefix}-city-input`}
            className={inputCls}
          />
        </div>
        {besideCity}
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1.5">Διεύθυνση</label>
        <div className="flex gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findFromAddress()}
            maxLength={200}
            placeholder="π.χ. Ερμού 15, Αθήνα"
            data-testid={`${testPrefix}-address-input`}
            className={inputCls}
          />
          <button
            onClick={findFromAddress}
            disabled={geocoding}
            data-testid={`${testPrefix}-geocode-btn`}
            className="h-10 px-4 shrink-0 rounded-md border border-[#723645] bg-[#2A0E14] text-sm font-bold text-neutral-300 hover:border-flame transition-colors flex items-center gap-2"
          >
            {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Εύρεση στον χάρτη
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-neutral-400">{mapLabel}</label>
          {latlng && (
            <span
              className="text-xs text-neutral-500 flex items-center gap-1"
              data-testid={`${testPrefix}-latlng`}
            >
              <MapPin className="w-3 h-3 text-flame" />
              {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
            </span>
          )}
        </div>
        <div
          ref={mapEl}
          data-testid={`${testPrefix}-map`}
          className="h-[300px] rounded-md border border-[#723645] overflow-hidden z-0"
        />
      </div>

      {children}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          data-testid={`${testPrefix}-details-save`}
          className="h-10 px-6 rounded-md bg-flame text-white text-sm font-bold hover:bg-flame/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </div>
    </div>
  );
}
