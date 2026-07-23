import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, User } from "lucide-react";
import { photonSearch } from "@/lib/api";
import { getAddressBookCached } from "@/lib/offline";

// Autocomplete διεύθυνσης για τη φόρμα παράδοσης του PDA.
// Προτάσεις: 1) γνωστές διευθύνσεις πελατών (πρώτες, με όνομα) 2) Photon geocoder
// με bias στις συντεταγμένες του καταστήματος και φίλτρο στην πόλη του.
// Ποτέ εμπόδιο στην πληκτρολόγηση: το Photon έχει debounce 200ms, min 2 χαρακτήρες,
// και offline/σφάλμα δεν μπλοκάρει — οι τοπικές προτάσεις δουλεύουν από cache.
// Κάθε early-return του Photon path γράφει console.warn για εύκολο debugging στο πεδίο.

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;
const DEFAULT_RADIUS_KM = 6;
const MAX_SUGGESTIONS = 6;

// Session cache query→αποτελέσματα Photon: ο ίδιος όρος (π.χ. backspace και ξανά)
// δεν ξαναχτυπάει το API. Δεν κρατάμε network errors — μόνο επιτυχημένες απαντήσεις.
const photonCache = new Map();
const PHOTON_CACHE_MAX = 200;
const cachedPhotonSearch = async (q, opts = {}) => {
  const key = `${q}|${opts.lat ?? ""}|${opts.lon ?? ""}|${opts.bbox ?? ""}`;
  if (photonCache.has(key)) return photonCache.get(key);
  const data = await photonSearch(q, opts);
  if (photonCache.size >= PHOTON_CACHE_MAX) photonCache.clear();
  photonCache.set(key, data);
  return data;
};

// Απόσταση haversine σε km — φίλτρο ζώνης διανομής γύρω από το pin του μαγαζιού
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// bbox για το Photon API: "minLon,minLat,maxLon,maxLat" γύρω από το μαγαζί
const radiusBbox = (lat, lon, km) => {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
};

// Πεζά + αφαίρεση τόνων για ελληνικό ταίριασμα ("παυ" ↔ "Παύλου")
const deaccent = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Το Photon συχνά γυρνάει city/locality σε λατινική μεταγραφή ("Ptolemaida", "Kozani")
// ενώ η πόλη του καταστήματος είναι στα ελληνικά — μεταγράφουμε τα ελληνικά σε λατινικά
// πριν τη σύγκριση ώστε να ταιριάζουν και οι δύο γραφές
const GREEKLISH = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ω: "o",
};
const norm = (s) =>
  deaccent(s)
    // Δίφθογγοι πρώτα: αυ→av, ευ→ev, ου→ou (αλλιώς "Παύλου"→"paylou" ≠ "Pavlou")
    .replace(/αυ/g, "av")
    .replace(/ευ/g, "ev")
    .replace(/ου/g, "ou")
    .replace(/[α-ως]/g, (ch) => GREEKLISH[ch] || ch);

// Κόβει το ", Πόλη" από το τέλος αποθηκευμένης διεύθυνσης — στο πεδίο μπαίνει μόνο η οδός,
// η πόλη έχει δικό της πεδίο (η αποθήκευση ενώνει "οδός, πόλη" στο buildDeliveryPayload)
const stripCity = (address, city) => {
  const a = (address || "").trim();
  const c = norm(city);
  if (!c) return a;
  const idx = a.lastIndexOf(",");
  if (idx === -1) return a;
  return norm(a.slice(idx + 1).trim()) === c ? a.slice(0, idx).trim() : a;
};

export default function AddressAutocomplete({
  value,
  onChange,
  city = "",
  storeLat,
  storeLng,
  radiusKm = DEFAULT_RADIUS_KM,
  onZoneStatus = null,
  placeholder,
  testId,
  className = "",
  // Πηγή "γνωστών διευθύνσεων" — default το address book του μαγαζιού·
  // το Fleet περνάει το δικό του (ίδιο σχήμα: [{address, name, lat, lng}])
  fetchBook = getAddressBookCached,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [photonResults, setPhotonResults] = useState([]);
  const [book, setBook] = useState([]);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  // Φόρτωση γνωστών διευθύνσεων μία φορά (online-first, cache fallback για offline).
  // Η κανονικοποίηση (norm) γίνεται ΜΙΑ φορά εδώ — όχι σε όλη τη λίστα ανά πλήκτρο.
  useEffect(() => {
    let alive = true;
    fetchBook()
      .then((b) => {
        if (alive) setBook((b || []).map((e) => ({ ...e, normAddress: norm(e.address) })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = (value || "").trim();

  // Ζώνη διανομής: ενεργή μόνο όταν υπάρχει pin μαγαζιού
  const hasZone = storeLat != null && storeLng != null;
  const zoneKm = Number(radiusKm) > 0 ? Number(radiusKm) : DEFAULT_RADIUS_KM;

  // Τοπικές προτάσεις: γνωστοί πελάτες που ταιριάζουν στο query — όσες έχουν
  // αποθηκευμένες συντεταγμένες (από το geocode cache) κόβονται εκτός ζώνης
  const localMatches = useMemo(() => {
    if (q.length < 1) return [];
    const qn = norm(q);
    return book
      .filter((e) => e.normAddress.includes(qn))
      .filter(
        (e) =>
          !hasZone ||
          e.lat == null ||
          e.lng == null ||
          distanceKm(storeLat, storeLng, e.lat, e.lng) <= zoneKm
      )
      .slice(0, 4)
      .map((e) => ({
        key: `local:${e.address}`,
        label: stripCity(e.address, city),
        sub: e.name || null,
        local: true,
      }));
  }, [q, book, city, hasZone, storeLat, storeLng, zoneKm]);

  // Photon: debounce + abort προηγούμενου request + σιωπηλή παράλειψη σε σφάλμα/offline
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (q.length < MIN_CHARS) {
      console.warn(`[AddressAutocomplete] skip: q="${q}" < ${MIN_CHARS} chars`);
      setPhotonResults([]);
      if (onZoneStatus) onZoneStatus(false);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const bbox = hasZone ? radiusBbox(storeLat, storeLng, zoneKm) : undefined;
        let data = await cachedPhotonSearch(q, {
          lat: storeLat,
          lon: storeLng,
          bbox,
          signal: ctrl.signal,
        });
        let features = data?.features || [];
        // Το bbox έκοψε τα πάντα; Δεύτερο αίτημα ΧΩΡΙΣ bbox για να ξεχωρίσουμε
        // "δεν υπάρχει τέτοια οδός" από "υπάρχει αλλά εκτός ζώνης διανομής"
        if (!features.length && bbox) {
          data = await cachedPhotonSearch(q, { lat: storeLat, lon: storeLng, signal: ctrl.signal });
          features = data?.features || [];
        }
        // Ξεκίνησε νεότερο query όσο περιμέναμε — ΠΟΤΕ render αποτελεσμάτων παλιού query
        if (ctrl.signal.aborted) return;
        const cityN = norm(city);
        const mapped = features
          .map((f) => {
            const p = f.properties || {};
            const street = p.type === "street" ? p.name : p.street || p.name;
            if (!street) return null;
            const label = p.housenumber ? `${street} ${p.housenumber}` : street;
            const places = [p.city, p.district, p.county, p.locality].filter(Boolean);
            const inCity =
              !cityN ||
              !places.length ||
              places.some((v) => norm(v).includes(cityN) || cityN.includes(norm(v)));
            const [flon, flat] = f.geometry?.coordinates || [];
            return { key: `photon:${label}`, label, sub: null, local: false, inCity, lat: flat, lon: flon };
          })
          .filter(Boolean);
        // Φίλτρο ζώνης διανομής: haversine από το pin του μαγαζιού — ό,τι είναι
        // πέρα από την ακτίνα κόβεται (το bbox είναι τετράγωνο, εδώ γίνεται κύκλος)
        const inZone = hasZone
          ? mapped.filter(
              (r) =>
                r.lat != null &&
                r.lon != null &&
                distanceKm(storeLat, storeLng, r.lat, r.lon) <= zoneKm
            )
          : mapped;
        // Η οδός υπάρχει αλλά μόνο εκτός ζώνης → μη μπλοκάρον warning στη φόρμα
        const outOfZone = hasZone && mapped.length > 0 && inZone.length === 0;
        if (onZoneStatus) onZoneStatus(outOfZone);
        if (outOfZone)
          console.warn(
            `[AddressAutocomplete] Photon: ${mapped.length} αποτελέσματα για q="${q}" αλλά όλα εκτός ζώνης ${zoneKm}km`
          );
        // Προτίμηση στην πόλη του καταστήματος — αλλά αν το φίλτρο θα άδειαζε τη λίστα
        // (το Photon γυρνάει λατινικές μεταγραφές ή ονόματα οικισμών/χωριών αντί για
        // την πόλη), κρατάμε όλα τα αποτελέσματα: το lat/lon bias ήδη τα κρατά κοντινά
        const cityMatches = inZone.filter((r) => r.inCity);
        if (!mapped.length)
          console.warn(`[AddressAutocomplete] Photon: κανένα feature για q="${q}"`);
        else if (inZone.length && !cityMatches.length)
          console.warn(
            `[AddressAutocomplete] Photon: κανένα από τα ${inZone.length} αποτελέσματα δεν ταιριάζει στην πόλη "${city}" — εμφανίζονται όλα (proximity bias)`
          );
        setPhotonResults(cityMatches.length ? cityMatches : inZone);
      } catch (err) {
        // AbortError = ο χρήστης συνέχισε να γράφει (φυσιολογικό) — ΔΕΝ αγγίζουμε το state,
        // το νεότερο query θα γράψει τα δικά του αποτελέσματα
        if (err?.name === "AbortError" || ctrl.signal.aborted) return;
        console.warn(`[AddressAutocomplete] Photon fetch απέτυχε για q="${q}": ${err?.name || err}`);
        setPhotonResults([]); // offline ή σφάλμα Photon — μόνο τοπικές προτάσεις
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, storeLat, storeLng, radiusKm]);

  // Συγχώνευση: τοπικές πρώτα, μετά Photon χωρίς διπλότυπα (και μεταξύ τους —
  // ίδια οδός μπορεί να έρθει από πολλούς γειτονικούς οικισμούς).
  // useMemo: δεν ξαναϋπολογίζεται σε renders από highlight/open (arrow keys, hover)
  const suggestions = useMemo(() => {
    const seen = new Set(localMatches.map((s) => norm(s.label)));
    const merged = [...localMatches];
    for (const s of photonResults) {
      if (merged.length >= MAX_SUGGESTIONS) break;
      const k = norm(s.label);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(s);
    }
    merged.length = Math.min(merged.length, MAX_SUGGESTIONS);
    return merged;
  }, [localMatches, photonResults]);

  const showDropdown = open && suggestions.length > 0;

  // Η επιλογή ΔΕΝ κλείνει το πεδίο: γεμίζει την οδό + κενό στο τέλος και κρατά το
  // focus με τον κέρσορα στο τέλος, ώστε ο χρήστης να γράψει αμέσως τον αριθμό
  const select = (s) => {
    const next = `${s.label} `;
    onChange(next);
    setOpen(false);
    setHighlight(-1);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
  };

  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault();
        select(suggestions[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        data-testid={testId}
        className="w-full h-9 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
      />
      {showDropdown && (
        <ul
          className="absolute z-30 left-0 right-0 top-full mt-1 bg-[#2A0E14] border border-[#723645] rounded-md shadow-lg overflow-hidden"
          data-testid="address-suggestions"
        >
          {suggestions.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                // onMouseDown πριν το blur του input — αλλιώς το dropdown κλείνει πριν το click
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                data-testid={`address-suggestion-${i}`}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-[#4A1B27] text-white" : "text-neutral-300"
                }`}
              >
                {s.local ? (
                  <User className="w-3.5 h-3.5 text-gold shrink-0" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-flame shrink-0" />
                )}
                <span className="truncate">{s.label}</span>
                {s.sub && (
                  <span className="ml-auto text-[11px] text-gold truncate shrink-0 max-w-[40%]">
                    {s.sub}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
