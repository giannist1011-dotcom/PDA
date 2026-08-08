import { useEffect, useRef, useState } from "react";
import MapCanvas from "@/components/shared/map/MapCanvas";
import { esc, fitToPoints, housePin, popupHtml, syncMarkers } from "@/components/shared/map/pins";

// Χάρτης συνεργαζόμενων μαγαζιών — ίδιος καμβάς/pins/popups με τους υπόλοιπους
// χάρτες (components/shared/map). Ένα pin ανά μαγαζί από το pin των ρυθμίσεών
// του· tap → popup με όνομα, διεύθυνση, τηλέφωνο (tap-to-call) και — μόνο στη
// διαχείριση (`showStats`) — πλήθος παραγγελιών σήμερα. Μαγαζιά χωρίς pin απλώς
// δεν εμφανίζονται (φαίνονται στη λίστα).

const storeIcon = housePin({ fill: "#E8590C", stroke: "#fff", size: 30 });

const storePopup = (s, showStats) =>
  popupHtml({
    title: esc(s.name),
    lines: [
      s.address ? `${esc(s.address)}${s.city ? `, ${esc(s.city)}` : ""}` : null,
      showStats
        ? `<b>Σήμερα: ${s.orders_today} ${s.orders_today === 1 ? "παραγγελία" : "παραγγελίες"}</b>`
        : null,
    ],
    link: s.phone ? { href: `tel:${esc(s.phone)}`, label: `📞 ${esc(s.phone)}` } : null,
  });

export default function StoresMap({
  stores,
  defaultCenter = null,
  onPinTap = null,
  showStats = false,
}) {
  const [map, setMap] = useState(null);
  const markersRef = useRef({});
  const onPinTapRef = useRef(onPinTap);
  onPinTapRef.current = onPinTap;

  const located = stores.filter((s) => s.lat != null && s.lng != null);
  const unlocated = stores.length - located.length;

  useEffect(() => {
    if (!map) return;
    syncMarkers(map, markersRef.current, located, {
      key: (s) => s.store_user_id,
      latlng: (s) => [s.lat, s.lng],
      icon: () => storeIcon,
      popup: (s) => storePopup(s, showStats),
      onClick: (s) => onPinTapRef.current?.(s.store_user_id),
    });
    fitToPoints(map, located.map((s) => [s.lat, s.lng]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stores, showStats]);

  return (
    <MapCanvas
      testId="fleet-stores-map"
      heightClass="h-[45vh] min-h-[280px]"
      center={defaultCenter}
      zoom={12}
      onReady={setMap}
      notes={[
        located.length === 0 ? "Κανένα συνεργαζόμενο μαγαζί με pin στον χάρτη" : null,
        unlocated > 0
          ? {
              small: true,
              testId: "fleet-stores-unlocated",
              text: `${unlocated === 1 ? "1 μαγαζί" : `${unlocated} μαγαζιά`} χωρίς pin — δεν έχουν ορίσει τοποθεσία στις ρυθμίσεις τους`,
            }
          : null,
      ]}
    />
  );
}
