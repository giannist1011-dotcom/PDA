import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Search, Loader2, Clock, Star, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/context/AuthContext";
import { apiUpdateStoreDetails, geocodeAddress, formatApiError } from "@/lib/api";
import StoreHoursEditor from "@/components/StoreHoursEditor";

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
  const [city, setCity] = useState(user?.store_city || "");
  const [latlng, setLatlng] = useState(
    user?.store_lat != null && user?.store_lng != null
      ? { lat: user.store_lat, lng: user.store_lng }
      : null
  );
  const [radiusKm, setRadiusKm] = useState(String(user?.delivery_radius_km ?? 6));
  const [hours, setHours] = useState(user?.store_hours || {});
  const [reviewLink, setReviewLink] = useState(user?.google_review_link || "");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const reviewQrRef = useRef(null);

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

  // Ίδια λογική με το QR του καταλόγου (PublicMenuSettings): λευκό περιθώριο + PNG download
  const downloadReviewQR = () => {
    const src = reviewQrRef.current?.querySelector("canvas");
    if (!src) return;
    const pad = 24;
    const out = document.createElement("canvas");
    out.width = src.width + pad * 2;
    out.height = src.height + pad * 2;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "google-review-qr.png";
    a.click();
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Το όνομα καταστήματος είναι υποχρεωτικό");
      return;
    }
    // Πέτα ημιτελείς γραμμές ωραρίου (κενό start/end) — το backend τις απορρίπτει με 422
    const cleanHours = {};
    for (const [k, d] of Object.entries(hours || {})) {
      cleanHours[k] = {
        closed: !!d.closed,
        ranges: (d.ranges || []).filter((r) => r.start && r.end),
      };
    }
    setSaving(true);
    try {
      await apiUpdateStoreDetails({
        restaurant_name: name.trim(),
        store_phone: phone.trim(),
        store_address: address.trim(),
        store_city: city.trim(),
        store_lat: latlng?.lat ?? null,
        store_lng: latlng?.lng ?? null,
        // 1–100 km, default 6 — κόβει τα αποτελέσματα του autocomplete διεύθυνσης
        delivery_radius_km: Math.min(100, Math.max(1, parseFloat(radiusKm) || 6)),
        store_hours: cleanHours,
        google_review_link: reviewLink.trim(),
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">
            Πόλη / Περιοχή — προστίθεται αυτόματα στις διευθύνσεις παραγγελιών για τον live χάρτη
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            placeholder="π.χ. Κοζάνη"
            data-testid="store-city-input"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">
            Ζώνη διανομής (km) — οι προτάσεις διεύθυνσης κόβονται έξω από αυτή την ακτίνα γύρω από το pin
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            placeholder="6"
            data-testid="delivery-radius-input"
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

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Clock className="w-4 h-4 text-flame" />
          <label className="text-xs text-neutral-400">
            Ωράριο λειτουργίας — εμφανίζεται στον δημόσιο κατάλογο με ένδειξη «Ανοιχτά τώρα»
          </label>
        </div>
        <StoreHoursEditor value={hours} onChange={setHours} />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Star className="w-4 h-4 text-gold" />
          <label className="text-xs text-neutral-400">
            Google review link — προαιρετικό· εμφανίζει κουμπί «Αξιολογήστε μας» στον δημόσιο κατάλογο
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            maxLength={300}
            placeholder="π.χ. https://g.page/r/XXXXXXXX/review"
            data-testid="review-link-input"
            className={`${inputCls} flex-1 min-w-[220px]`}
          />
          <button
            type="button"
            onClick={downloadReviewQR}
            disabled={!reviewLink.trim()}
            data-testid="review-qr-btn"
            className="h-10 px-4 shrink-0 rounded-md border border-[#723645] bg-[#2A0E14] text-sm font-bold text-neutral-300 hover:border-flame transition-colors flex items-center gap-2 disabled:opacity-40 disabled:hover:border-[#723645]"
          >
            <QrCode className="w-4 h-4" />
            Λήψη QR
          </button>
        </div>
        {/* Κρυφό canvas μόνο για την παραγωγή του PNG */}
        {reviewLink.trim() && (
          <div ref={reviewQrRef} className="hidden">
            <QRCodeCanvas value={reviewLink.trim()} size={296} level="M" />
          </div>
        )}
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
