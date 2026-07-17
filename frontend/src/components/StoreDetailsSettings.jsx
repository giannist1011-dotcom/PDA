import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Search, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/context/AuthContext";
import { apiUpdateStoreDetails, geocodeAddress, formatApiError } from "@/lib/api";

// Προεπιλεγμένο κέντρο χάρτη όταν δεν υπάρχει pin: Αθήνα
const DEFAULT_CENTER = [37.9838, 23.7275];

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#E8590C" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.6))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

const inputCls =
  "w-full h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] focus:border-flame outline-none text-sm";

export default function StoreDetailsSettings() {
  const { user, refreshMe } = useAuth();
  const [name, setName] = useState(user?.restaurant_name || "");
  const [phone, setPhone] = useState(user?.store_phone || "");
  const [address, setAddress] = useState(user?.store_address || "");
  const [latlng, setLatlng] = useState(
    user?.store_lat != null && user?.store_lng != null
      ? { lat: user.store_lat, lng: user.store_lng }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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
    const start = latlng ? [latlng.lat, latlng.lng] : DEFAULT_CENTER;
    const map = L.map(mapEl.current, { attributionControl: false }).setView(
      start,
      latlng ? 16 : 11
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
    map.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng, false));
    mapRef.current = map;
    if (latlng) {
      markerRef.current = L.marker([latlng.lat, latlng.lng], { icon: pinIcon }).addTo(map);
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
      const results = await geocodeAddress(address.trim());
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
      toast.error("Το όνομα καταστήματος είναι υποχρεωτικό");
      return;
    }
    setSaving(true);
    try {
      await apiUpdateStoreDetails({
        restaurant_name: name.trim(),
        store_phone: phone.trim(),
        store_address: address.trim(),
        store_lat: latlng?.lat ?? null,
        store_lng: latlng?.lng ?? null,
      });
      await refreshMe();
      toast.success("Τα στοιχεία καταστήματος αποθηκεύτηκαν");
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
          <label className="block text-xs text-neutral-400 mb-1.5">Όνομα καταστήματος</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            data-testid="store-name-input"
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
            data-testid="store-phone-input"
            className={inputCls}
          />
        </div>
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
            data-testid="store-address-input"
            className={inputCls}
          />
          <button
            onClick={findFromAddress}
            disabled={geocoding}
            data-testid="store-geocode-btn"
            className="h-10 px-4 shrink-0 rounded-md border border-[#723645] bg-[#2A0E14] text-sm font-bold text-neutral-300 hover:border-flame transition-colors flex items-center gap-2"
          >
            {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Εύρεση στον χάρτη
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-neutral-400">
            Τοποθεσία — πατήστε στον χάρτη για να βάλετε pin στο μαγαζί
          </label>
          {latlng && (
            <span className="text-xs text-neutral-500 flex items-center gap-1" data-testid="store-latlng">
              <MapPin className="w-3 h-3 text-flame" />
              {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
            </span>
          )}
        </div>
        <div
          ref={mapEl}
          data-testid="store-map"
          className="h-[300px] rounded-md border border-[#723645] overflow-hidden z-0"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          data-testid="store-details-save"
          className="h-10 px-6 rounded-md bg-flame text-white text-sm font-bold hover:bg-flame/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </div>
    </div>
  );
}
