import L from "leaflet";

// ---------------------------------------------------------------------------
// Η ΜΙΑ γλώσσα των χαρτών (OrderDeck + FleetDeck + admin panel): tiles, pins,
// popups, fit/sync. Κανένας χάρτης δεν φτιάχνει δικό του tile layer, δικό του
// εικονίδιο ή δικό του popup markup — όλα περνούν από εδώ ώστε οι δύο
// εφαρμογές να δείχνουν ίδιες.
// ---------------------------------------------------------------------------

// Θέα «όλη η Ελλάδα» — το fallback κάθε χάρτη χωρίς κέντρο
export const GREECE_VIEW = { lat: 38.3, lng: 23.8, zoom: 6 };

// Το κοινό κουτί του χάρτη (border/γωνίες/z-index) — ίδιο σε κάθε επιφάνεια
export const MAP_BOX = "rounded-lg border border-[#723645] overflow-hidden z-0";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Το κοινό tile layer + attribution των Leaflet χαρτών της εφαρμογής
export const addBaseLayer = (map) => {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
  return map;
};

// ---------------------------------- PINS -----------------------------------

// Σταγόνα — το βασικό pin (παραγγελίες, τοποθεσία καταστήματος, φόρμες).
// `label` = αριθμός μέσα στο pin, `badge` = emoji πάνω δεξιά (π.χ. ⚡),
// `dot` = λευκή κουκκίδα στο κέντρο (pin φόρμας/καταστήματος).
export const dropPin = ({
  fill = "#F97316",
  stroke = "#2A0E14",
  strokeWidth = 1.2,
  size = 34,
  label = null,
  labelColor = "#fff",
  dot = false,
  badge = null,
} = {}) => {
  const h = label != null || badge ? size + 6 : size;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${h}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>${
        dot ? `<circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>` : ""
      }</svg>
      ${
        label != null
          ? `<div style="position:absolute;top:${Math.round(size * 0.15)}px;left:0;width:${size}px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:bold;font-size:10px;color:${labelColor};text-shadow:0 1px 2px rgba(0,0,0,.5)">${esc(label)}</div>`
          : ""
      }
      ${badge ? `<div style="position:absolute;top:-8px;right:-3px;font-size:13px">${badge}</div>` : ""}
    </div>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, size - 2],
  });
};

// Σπιτάκι — σημεία «κατάστημα / παραλαβή», ξεχωρίζουν με μια ματιά από τις σταγόνες
export const housePin = ({ fill = "#E8590C", stroke = "#fff", size = 30 } = {}) => {
  const h = Math.round(size * 1.2);
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${h}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">
      <svg width="${size}" height="${h}" viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 28 4 18h16Z" fill="${fill}"/>
        <rect x="2" y="2" width="20" height="17" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
        <path d="M7 15v-5h10v5" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M5 9.5 12 5l7 4.5" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, h - 2],
  });
};

// Κύκλος με αριθμό — συγκεντρωτικά σημεία (χάρτης επέκτασης του admin)
export const bubblePin = ({ size = 30, background = "#F97316", label = "", muted = false } = {}) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${background};
      border:2px solid #2A0E14;box-shadow:0 2px 6px rgba(0,0,0,.55);display:flex;
      align-items:center;justify-content:center;color:#fff;font-weight:bold;
      font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${Math.max(11, Math.round(size / 3))}px;
      ${muted ? "opacity:.9;" : ""}">${esc(label)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

// Το pin των φορμών τοποθεσίας (ρυθμίσεις επιχείρησης, επιλογή σημείου παραλαβής)
export const formPinIcon = dropPin({ stroke: "#fff", strokeWidth: 1.5, dot: true });

// --------------------------------- POPUPS ----------------------------------

// Το ΕΝΑ popup της εφαρμογής: τίτλος, γραμμές λεπτομερειών, τονισμένη γραμμή,
// προαιρετικός σύνδεσμος. Ο caller κάνει esc() στα δικά του δεδομένα (οι
// γραμμές επιτρέπεται να περιέχουν markup, π.χ. <b>).
export const popupHtml = ({ title, lines = [], accent = null, link = null, minWidth = 170 }) => `
  <div style="font-family:inherit;min-width:${minWidth}px;color:#2A0E14">
    <div style="font-weight:bold;font-size:14px;margin-bottom:4px">${title}</div>
    ${lines
      .filter(Boolean)
      .map((l) => `<div style="font-size:12px;color:#555">${l}</div>`)
      .join("")}
    ${accent ? `<div style="font-weight:bold;color:#B8860B;margin-top:4px">${accent}</div>` : ""}
    ${
      link
        ? `<a href="${link.href}"${link.external ? ' target="_blank" rel="noreferrer"' : ""} style="display:inline-block;margin-top:4px;font-weight:bold;color:#B8860B">${link.label}</a>`
        : ""
    }
  </div>`;

// ------------------------------ MARKERS / VIEW -----------------------------

// Συγχρονισμός markers με μια λίστα: ενημέρωση όσων υπάρχουν, προσθήκη νέων,
// αφαίρεση όσων έφυγαν. `store` = mutable object (useRef().current) id → marker.
export const syncMarkers = (map, store, items, { key, latlng, icon, popup, onClick }) => {
  if (!map) return;
  const alive = new Set();
  items.forEach((it) => {
    const id = key(it);
    alive.add(id);
    const existing = store[id];
    if (existing) {
      existing.setLatLng(latlng(it));
      if (icon) existing.setIcon(icon(it));
      if (popup) existing.setPopupContent(popup(it));
    } else {
      const m = L.marker(latlng(it), icon ? { icon: icon(it) } : {}).addTo(map);
      if (popup) m.bindPopup(popup(it));
      if (onClick) m.on("click", () => onClick(it));
      store[id] = m;
    }
  });
  Object.keys(store).forEach((id) => {
    if (!alive.has(id)) {
      map.removeLayer(store[id]);
      delete store[id];
    }
  });
};

// Προσαρμογή θέας στα σημεία. Με `once` (default) γίνεται ΜΙΑ φορά και μετά ο
// χάρτης δεν ξανακεντράρεται μόνος του (το ίδιο flag διαβάζει το MapCanvas για
// να μη χαλάσει το fit με καθυστερημένο κέντρο πόλης).
export const fitToPoints = (map, points, { maxZoom = 15, pad = 0.25, once = true } = {}) => {
  if (!map || !points.length) return false;
  if (once && map._pkFitted) return false;
  map.fitBounds(L.latLngBounds(points).pad(pad), { maxZoom });
  map._pkFitted = true;
  return true;
};

export const hasFitted = (map) => !!(map && map._pkFitted);
