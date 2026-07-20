import { useEffect, useRef, useState } from "react";
import { MapPin, User } from "lucide-react";
import { photonSearch } from "@/lib/api";
import { getAddressBookCached } from "@/lib/offline";

// Autocomplete διεύθυνσης για τη φόρμα παράδοσης του PDA.
// Προτάσεις: 1) γνωστές διευθύνσεις πελατών (πρώτες, με όνομα) 2) Photon geocoder
// με bias στις συντεταγμένες του καταστήματος και φίλτρο στην πόλη του.
// Ποτέ εμπόδιο στην πληκτρολόγηση: το Photon έχει debounce 300ms, min 2 χαρακτήρες,
// και offline/σφάλμα παραλείπεται σιωπηλά — οι τοπικές προτάσεις δουλεύουν από cache.

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

// Πεζά + αφαίρεση τόνων για ελληνικό ταίριασμα ("παυ" ↔ "Παύλου")
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

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
  placeholder,
  testId,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [photonResults, setPhotonResults] = useState([]);
  const [book, setBook] = useState([]);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Φόρτωση γνωστών διευθύνσεων μία φορά (online-first, cache fallback για offline)
  useEffect(() => {
    let alive = true;
    getAddressBookCached().then((b) => {
      if (alive) setBook(b || []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const q = (value || "").trim();

  // Τοπικές προτάσεις: γνωστοί πελάτες που ταιριάζουν στο query
  const localMatches =
    q.length >= 1
      ? book
          .filter((e) => norm(e.address).includes(norm(q)))
          .slice(0, 4)
          .map((e) => ({
            key: `local:${e.address}`,
            label: stripCity(e.address, city),
            sub: e.name || null,
            local: true,
          }))
      : [];

  // Photon: debounce + abort προηγούμενου request + σιωπηλή παράλειψη σε σφάλμα/offline
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (q.length < MIN_CHARS) {
      setPhotonResults([]);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const data = await photonSearch(q, {
          lat: storeLat,
          lon: storeLng,
          signal: ctrl.signal,
        });
        const cityN = norm(city);
        const results = (data?.features || [])
          .map((f) => {
            const p = f.properties || {};
            const street = p.type === "street" ? p.name : p.street || p.name;
            if (!street) return null;
            const label = p.housenumber ? `${street} ${p.housenumber}` : street;
            const places = [p.city, p.district, p.county, p.locality].filter(Boolean);
            // Φίλτρο στην πόλη του καταστήματος (χαλαρό, χωρίς τόνους)
            if (
              cityN &&
              places.length &&
              !places.some((v) => norm(v).includes(cityN) || cityN.includes(norm(v)))
            )
              return null;
            return { key: `photon:${label}`, label, sub: null, local: false };
          })
          .filter(Boolean);
        setPhotonResults(results);
      } catch {
        setPhotonResults([]); // offline ή σφάλμα Photon — μόνο τοπικές προτάσεις, χωρίς μήνυμα
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, storeLat, storeLng]);

  // Συγχώνευση: τοπικές πρώτα, μετά Photon χωρίς διπλότυπα
  const seen = new Set(localMatches.map((s) => norm(s.label)));
  const suggestions = [
    ...localMatches,
    ...photonResults.filter((s) => !seen.has(norm(s.label))),
  ].slice(0, 8);

  const showDropdown = open && suggestions.length > 0;

  const select = (s) => {
    onChange(s.label);
    setOpen(false);
    setHighlight(-1);
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
