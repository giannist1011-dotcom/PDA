import { useEffect, useRef, useState } from "react";
import { MapPin, User } from "lucide-react";
import { photonSearch } from "@/lib/api";
import { getAddressBookCached } from "@/lib/offline";

// Autocomplete διεύθυνσης για τη φόρμα παράδοσης του PDA.
// Προτάσεις: 1) γνωστές διευθύνσεις πελατών (πρώτες, με όνομα) 2) Photon geocoder
// με bias στις συντεταγμένες του καταστήματος και φίλτρο στην πόλη του.
// Ποτέ εμπόδιο στην πληκτρολόγηση: το Photon έχει debounce 300ms, min 3 χαρακτήρες,
// και offline/σφάλμα δεν μπλοκάρει — οι τοπικές προτάσεις δουλεύουν από cache.
// Κάθε early-return του Photon path γράφει console.warn για εύκολο debugging στο πεδίο.

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

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
      console.warn(`[AddressAutocomplete] skip: q="${q}" < ${MIN_CHARS} chars`);
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
        const mapped = (data?.features || [])
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
            return { key: `photon:${label}`, label, sub: null, local: false, inCity };
          })
          .filter(Boolean);
        // Προτίμηση στην πόλη του καταστήματος — αλλά αν το φίλτρο θα άδειαζε τη λίστα
        // (το Photon γυρνάει λατινικές μεταγραφές ή ονόματα οικισμών/χωριών αντί για
        // την πόλη), κρατάμε όλα τα αποτελέσματα: το lat/lon bias ήδη τα κρατά κοντινά
        const cityMatches = mapped.filter((r) => r.inCity);
        if (!mapped.length)
          console.warn(`[AddressAutocomplete] Photon: κανένα feature για q="${q}"`);
        else if (!cityMatches.length)
          console.warn(
            `[AddressAutocomplete] Photon: κανένα από τα ${mapped.length} αποτελέσματα δεν ταιριάζει στην πόλη "${city}" — εμφανίζονται όλα (proximity bias)`
          );
        setPhotonResults(cityMatches.length ? cityMatches : mapped);
      } catch (err) {
        // AbortError = ο χρήστης συνέχισε να γράφει (φυσιολογικό) — δεν είναι αποτυχία
        if (err?.name !== "AbortError")
          console.warn(`[AddressAutocomplete] Photon fetch απέτυχε για q="${q}": ${err?.name || err}`);
        setPhotonResults([]); // offline ή σφάλμα Photon — μόνο τοπικές προτάσεις
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, storeLat, storeLng]);

  // Συγχώνευση: τοπικές πρώτα, μετά Photon χωρίς διπλότυπα (και μεταξύ τους —
  // ίδια οδός μπορεί να έρθει από πολλούς γειτονικούς οικισμούς)
  const seen = new Set(localMatches.map((s) => norm(s.label)));
  const suggestions = [...localMatches];
  for (const s of photonResults) {
    const k = norm(s.label);
    if (seen.has(k)) continue;
    seen.add(k);
    suggestions.push(s);
  }
  suggestions.length = Math.min(suggestions.length, 8);

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
