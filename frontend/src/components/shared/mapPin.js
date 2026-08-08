import L from "leaflet";

// Το ΕΝΑ pin εικονίδιο των φορμών τοποθεσίας (ρυθμίσεις επιχείρησης, επιλογή
// σημείου παραλαβής): σταγόνα στο χρώμα flame με λευκό περίγραμμα. Ό,τι βάζει
// pin σε χάρτη φόρμας το παίρνει από εδώ — καμία δεύτερη εκδοχή.
export const formPinIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#E8590C" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.6))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

// Το κοινό tile layer + attribution των Leaflet χαρτών της εφαρμογής
export const addBaseLayer = (map) => {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
  return map;
};
