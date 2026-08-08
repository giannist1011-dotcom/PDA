import { MapPin, Phone, Store, StickyNote, Timer, Zap, Pencil } from "lucide-react";
import {
  STATUS_META,
  EDIT_FIELD_LABELS,
  ageColorClass,
  fmtTime,
  mapsUrl,
  minutesSince,
  pickupPoint,
} from "@/components/fleet/utils";

// Κάρτα παραγγελίας οδηγού — module-level ώστε να μην γίνεται remount σε κάθε poll.
// Χρονόμετρο ηλικίας: σε αναμονή → από την καταχώρηση (με χρώμα όσο περιμένει),
// σε claimed → από το claim. Ανανεώνεται με το υπάρχον polling.
export function DriverCard({ o, city, dim = false, showStatus = false, highlight = false, children }) {
  const ageIso = o.status === "waiting" ? o.created_at : o.claimed_at;
  const mins = ["waiting", "pickup", "enroute"].includes(o.status) ? minutesSince(ageIso) : null;
  const ageCls = o.status === "waiting" ? ageColorClass(mins) : "text-neutral-500";
  const urgent = o.urgent && o.status === "waiting";
  const edited = ["pickup", "enroute"].includes(o.status) && o.updated_fields?.length;
  const pickup = pickupPoint(o);
  return (
    <div
      className={`bg-[#3D1620] border rounded-lg p-4 transition-shadow ${dim ? "opacity-60" : ""} ${
        urgent ? "border-gold ring-1 ring-gold/40" : "border-[#723645]"
      } ${highlight ? "ring-2 ring-flame border-flame" : ""}`}
      data-testid={`fleet-drv-order-${o.id}`}
    >
      {urgent && (
        <div className="flex items-center gap-1 mb-1.5 text-xs font-bold text-gold">
          <Zap className="w-3.5 h-3.5" /> ΕΠΕΙΓΟΝ
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg">#{o.number}</span>
        <span className="truncate text-neutral-300">{o.pickup_name}</span>
        {mins !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-bold shrink-0 ${ageCls}`}
            data-testid={`fleet-drv-age-${o.id}`}
          >
            <Timer className="w-3.5 h-3.5" /> {mins}'
          </span>
        )}
        <span className="ml-auto text-xs text-neutral-500">{fmtTime(o.created_at)}</span>
      </div>
      {/* Σημείο παραλαβής — tap → Google Maps στο pin του (ή στο κείμενό του),
          ακριβώς όπως και η διεύθυνση παράδοσης από κάτω */}
      {pickup && (pickup.lat != null || pickup.address) && (
        <a
          href={mapsUrl(pickup.address || pickup.name, city, pickup.lat, pickup.lng)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 mt-2 text-sm text-neutral-300 active:text-flame"
          data-testid={`fleet-drv-pickup-${o.id}`}
        >
          <Store className="w-4 h-4 text-gold shrink-0" />
          <span className="truncate underline underline-offset-2">
            Παραλαβή: {pickup.address || pickup.name}
          </span>
        </a>
      )}
      <a
        href={mapsUrl(o.address, city, o.lat, o.lng)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 mt-2 text-white active:text-flame"
      >
        <MapPin className="w-4 h-4 text-flame shrink-0" />
        <span className="underline underline-offset-2">{o.address}</span>
      </a>
      {/* Όροφος/κουδούνι — μέρος της διεύθυνσης, ακριβώς κάτω από αυτήν */}
      {o.floor && (
        <div className="mt-1 text-sm text-neutral-300 pl-6" data-testid={`fleet-drv-floor-${o.id}`}>
          Όροφος: {o.floor}
        </div>
      )}
      {/* Τηλέφωνο πελάτη (παραγγελίες καταστημάτων) — tap για κλήση */}
      {o.phone && (
        <a
          href={`tel:${o.phone}`}
          className="flex items-center gap-2 mt-1.5 text-sm text-neutral-300 active:text-flame"
          data-testid={`fleet-drv-phone-${o.id}`}
        >
          <Phone className="w-4 h-4 text-flame shrink-0" />
          {o.phone}
        </a>
      )}
      {showStatus && (
        <span
          className={`inline-block mt-2 px-2 py-0.5 rounded border text-[11px] font-semibold ${STATUS_META[o.status]?.badge || ""}`}
        >
          {STATUS_META[o.status]?.emoji} {STATUS_META[o.status]?.label}
        </span>
      )}
      {edited ? (
        <div
          className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-gold"
          data-testid={`fleet-drv-updated-${o.id}`}
        >
          <Pencil className="w-3.5 h-3.5" />
          Ενημερώθηκε: {o.updated_fields.map((f) => EDIT_FIELD_LABELS[f] || f).join(", ")}
        </div>
      ) : null}
      {o.notes && (
        <div className="flex items-start gap-1.5 mt-2 text-sm text-neutral-400">
          <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{o.notes}</span>
        </div>
      )}
      {children}
    </div>
  );
}

