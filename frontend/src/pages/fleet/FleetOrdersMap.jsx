import { useEffect, useRef, useState } from "react";
import MapCanvas from "@/components/shared/map/MapCanvas";
import {
  dropPin,
  esc,
  fitToPoints,
  housePin,
  popupHtml,
  syncMarkers,
} from "@/components/shared/map/pins";
import { STATUS_META, minutesSince } from "@/components/fleet/utils";

// Χάρτης παραγγελιών FleetDeck — ίδιος καμβάς/pins/popups με τον live χάρτη του
// OrderDeck (components/shared/map). Τα pins είναι ΔΙΕΥΘΥΝΣΕΙΣ ΠΑΡΑΓΓΕΛΙΩΝ —
// ποτέ θέσεις οδηγών. Χρώμα ανά κατάσταση (🔴🟡🟢), ⚡ επείγουσες με χρυσό
// δαχτυλίδι + κεραυνό. Παραγγελίες χωρίς συντεταγμένες απλώς δεν εμφανίζονται
// (μικρή ένδειξη από κάτω). Ανανεώνεται με το polling της σελίδας που τον
// φιλοξενεί — κανένα δικό του poll.

const pinIcon = (o) =>
  dropPin({
    fill: (STATUS_META[o.status] || STATUS_META.waiting).dot,
    stroke: o.urgent ? "#FFC300" : "#2A0E14",
    strokeWidth: o.urgent ? 2.2 : 1.2,
    label: o.number,
    badge: o.urgent ? "⚡" : null,
  });

// Pin ΣΗΜΕΙΟΥ ΠΑΡΑΛΑΒΗΣ — χρυσό σπιτάκι, ξεχωρίζει με μια ματιά από τις σταγόνες
const pickupIcon = housePin({ fill: "#FFC300", stroke: "#2A0E14", size: 28 });

const pickupPopup = (o) =>
  popupHtml({
    title: "📦 Παραλαβή",
    minWidth: 150,
    lines: [esc(o.pickup_name), o.pickup_address ? esc(o.pickup_address) : null],
    link: {
      href: `https://www.google.com/maps/search/?api=1&query=${o.pickup_lat},${o.pickup_lng}`,
      label: "Άνοιγμα στο Google Maps",
      external: true,
    },
  });

// Popup = η κάρτα της παραγγελίας: αριθμός, κατάστημα, διεύθυνση, οδηγός, ⏱ λεπτά
const orderPopup = (o) => {
  const meta = STATUS_META[o.status] || STATUS_META.waiting;
  const mins = minutesSince(o.created_at);
  return popupHtml({
    title: `${o.urgent ? "⚡ " : ""}#${esc(o.number)} · ${meta.emoji} ${esc(meta.label)}`,
    minWidth: 180,
    lines: [
      esc(o.pickup_name),
      `${esc(o.address)}${o.floor ? ` · Όροφος: ${esc(o.floor)}` : ""}`,
      `🛵 ${esc(o.driver_name || "—")}`,
    ],
    accent: mins != null ? `⏱ ${mins}'` : null,
  });
};

export default function FleetOrdersMap({
  orders,
  // Default κέντρο χωρίς παραγγελίες: το pin/πόλη του λογαριασμού ({lat, lng}) —
  // null → θέα Ελλάδας. Μπορεί να έρθει καθυστερημένα (async geocode πόλης).
  defaultCenter = null,
  heightClass = "h-[55vh] min-h-[320px]",
  withPopups = true,
  // Δεύτερο pin ανά παραγγελία στο σημείο παραλαβής (χρυσό, με δικό του popup
  // + σύνδεσμο Google Maps) — η οθόνη του οδηγού το θέλει, ο πίνακας όχι
  showPickups = false,
  onPinTap = null,
  emptyText = "Καμία ενεργή παραγγελία με pin στον χάρτη",
}) {
  const [map, setMap] = useState(null);
  const markersRef = useRef({}); // order id -> Leaflet marker
  const pickupsRef = useRef({}); // order id -> Leaflet marker (σημείο παραλαβής)
  // Σταθερό handler για τα click listeners των markers (δεν ξαναδένονται ανά poll)
  const onPinTapRef = useRef(onPinTap);
  onPinTapRef.current = onPinTap;

  const located = orders.filter((o) => o.lat != null && o.lng != null);
  const unlocated = orders.length - located.length;
  const pickups = showPickups
    ? orders.filter((o) => o.pickup_lat != null && o.pickup_lng != null)
    : [];

  useEffect(() => {
    if (!map) return;
    syncMarkers(map, markersRef.current, located, {
      key: (o) => o.id,
      latlng: (o) => [o.lat, o.lng],
      icon: pinIcon,
      popup: withPopups ? orderPopup : null,
      onClick: (o) => onPinTapRef.current?.(o.id),
    });
    syncMarkers(map, pickupsRef.current, pickups, {
      key: (o) => o.id,
      latlng: (o) => [o.pickup_lat, o.pickup_lng],
      icon: () => pickupIcon,
      popup: pickupPopup,
      onClick: (o) => onPinTapRef.current?.(o.id),
    });
    fitToPoints(map, [
      ...located.map((o) => [o.lat, o.lng]),
      ...pickups.map((o) => [o.pickup_lat, o.pickup_lng]),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, orders, withPopups, showPickups]);

  return (
    <MapCanvas
      testId="fleet-orders-map"
      heightClass={heightClass}
      center={defaultCenter}
      onReady={setMap}
      notes={[
        located.length === 0 && emptyText ? emptyText : null,
        unlocated > 0
          ? {
              small: true,
              testId: "fleet-map-unlocated",
              text: `${unlocated === 1 ? "1 παραγγελία" : `${unlocated} παραγγελίες`} χωρίς pin — η διεύθυνση δεν έχει συντεταγμένες (επιλέξτε πρόταση στην επεξεργασία για να εμφανιστεί)`,
            }
          : null,
      ]}
    />
  );
}
