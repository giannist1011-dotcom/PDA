import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, X } from "lucide-react";
import AddressAutocomplete from "@/components/shared/AddressAutocomplete";
import { geocodeCityCenter } from "@/lib/api";
import { addBaseLayer, formPinIcon } from "@/components/shared/mapPin";

// Επιλογή ελεύθερου σημείου (κείμενο + pin) — ΤΟ κοινό component για κάθε φόρμα
// που χρειάζεται «διεύθυνση + ακριβές σημείο στον χάρτη»: το ίδιο
// AddressAutocomplete με τις άλλες φόρμες (bias πόλη/pin λογαριασμού,
// accent-insensitive, αριθμός οδού = κείμενο) + χάρτης με σερνόμενο pin.
// Το pin ακολουθεί την επιλογή πρότασης· ο χρήστης το διορθώνει σέρνοντάς το
// ή πατώντας στον χάρτη. Επιστρέφει {address, lat, lng} — lat/lng null όταν
// δεν μπήκε ποτέ pin (το κείμενο αρκεί, το σημείο απλώς λείπει από τον χάρτη).
const GREECE_CENTER = [38.3, 23.8];
const GREECE_ZOOM = 6;

export default function AddressPickerModal({
  title = "Διεύθυνση παραλαβής",
  initialAddress = "",
  initialLat = null,
  initialLng = null,
  city = "",
  accountLat = null,
  accountLng = null,
  radiusKm,
  fetchBook,
  onClose,
  onSave,
  testId = "address-picker",
}) {
  const [address, setAddress] = useState(initialAddress);
  const [latlng, setLatlng] = useState(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const hasPinRef = useRef(!!latlng);
  hasPinRef.current = !!latlng;

  // Ένα σημείο αλήθειας για την τοποθέτηση: χάρτης (click/drag) και επιλογή
  // πρότασης του autocomplete περνούν από εδώ
  const placePin = (lat, lng, pan) => {
    setLatlng({ lat, lng });
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { icon: formPinIcon, draggable: true }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        setLatlng({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = m;
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 16));
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const start = latlng
      ? [latlng.lat, latlng.lng]
      : accountLat != null && accountLng != null
        ? [accountLat, accountLng]
        : GREECE_CENTER;
    const zoomed = !!latlng || (accountLat != null && accountLng != null);
    const map = addBaseLayer(
      L.map(mapEl.current, { attributionControl: false }).setView(
        start,
        latlng ? 16 : zoomed ? 13 : GREECE_ZOOM
      )
    );
    map.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng, false));
    mapRef.current = map;
    if (latlng) placePin(latlng.lat, latlng.lng, false);
    else if (!zoomed && (city || "").trim()) {
      // Χωρίς pin και χωρίς pin λογαριασμού: κεντράρισμα στην πόλη (αν βρεθεί)
      geocodeCityCenter(city).then((c) => {
        if (c && mapRef.current && !hasPinRef.current) mapRef.current.setView([c.lat, c.lng], 13);
      });
    }
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    onSave({
      address: address.trim(),
      lat: latlng?.lat ?? null,
      lng: latlng?.lng ?? null,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-[#3D1620] border border-[#723645] rounded-lg p-4 space-y-3"
        data-testid={testId}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-flame shrink-0" />
          <h2 className="font-heading font-bold text-lg flex-1 truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testId}-close`}
            className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          onPick={(c) => c && placePin(c.lat, c.lng, true)}
          city={city}
          storeLat={accountLat}
          storeLng={accountLng}
          radiusKm={radiusKm}
          fetchBook={fetchBook}
          placeholder="Οδός και αριθμός"
          testId={`${testId}-input`}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-neutral-400">
              Σύρετε το pin ή πατήστε στον χάρτη για ακριβές σημείο
            </span>
            {latlng && (
              <span
                className="text-[11px] text-neutral-500 flex items-center gap-1 shrink-0"
                data-testid={`${testId}-latlng`}
              >
                <MapPin className="w-3 h-3 text-flame" />
                {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
              </span>
            )}
          </div>
          <div
            ref={mapEl}
            data-testid={`${testId}-map`}
            className="h-[260px] rounded-md border border-[#723645] overflow-hidden z-0"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!address.trim()}
            data-testid={`${testId}-save`}
            className="flex-1 h-11 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-bold disabled:opacity-60"
          >
            Καταχώρηση
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-md border border-[#723645] text-neutral-300 text-sm hover:bg-white/5"
          >
            Άκυρο
          </button>
        </div>
      </div>
    </div>
  );
}
