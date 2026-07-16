// Dynamic favicon: όταν το μαγαζί έχει δικό του λογότυπο, αντικαθιστούμε
// runtime τα <link rel="icon"> με αυτό. Στο logout/unmount επανέρχονται
// τα default OrderDeck favicons που είχε το index.html.
let defaultIcons = null;

const captureDefaults = () => {
  if (!defaultIcons) {
    defaultIcons = Array.from(
      document.querySelectorAll('link[rel="icon"]:not([data-store-favicon])')
    ).map((l) => l.cloneNode());
  }
};

export function setFavicon(url) {
  if (!url) {
    resetFavicon();
    return;
  }
  captureDefaults();
  const existing = document.querySelector('link[rel="icon"][data-store-favicon]');
  if (existing) {
    // Ήδη σε custom mode — απλή αλλαγή href, χωρίς remove/append (όχι flicker)
    if (existing.href !== url) existing.href = url;
    return;
  }
  document.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = url;
  link.setAttribute("data-store-favicon", "1");
  document.head.appendChild(link);
}

export function resetFavicon() {
  const dynamic = document.querySelectorAll('link[rel="icon"][data-store-favicon]');
  if (!dynamic.length) return;
  dynamic.forEach((l) => l.remove());
  (defaultIcons || []).forEach((l) => document.head.appendChild(l.cloneNode()));
}
