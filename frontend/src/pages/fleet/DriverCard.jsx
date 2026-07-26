import { MapPin, StickyNote, Timer } from "lucide-react";
import { STATUS_META, ageColorClass, fmtTime, mapsUrl, minutesSince } from "./utils";

// Κάρτα παραγγελίας οδηγού — module-level ώστε να μην γίνεται remount σε κάθε poll.
// Χρονόμετρο ηλικίας: σε αναμονή → από την καταχώρηση (με χρώμα όσο περιμένει),
// σε claimed → από το claim. Ανανεώνεται με το υπάρχον polling.
export function DriverCard({ o, city, dim = false, showStatus = false, children }) {
  const ageIso = o.status === "waiting" ? o.created_at : o.claimed_at;
  const mins = ["waiting", "pickup", "enroute"].includes(o.status) ? minutesSince(ageIso) : null;
  const ageCls = o.status === "waiting" ? ageColorClass(mins) : "text-neutral-500";
  return (
    <div
      className={`bg-[#3D1620] border border-[#723645] rounded-lg p-4 ${dim ? "opacity-60" : ""}`}
      data-testid={`fleet-drv-order-${o.id}`}
    >
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
      <a
        href={mapsUrl(o.address, city)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 mt-2 text-white active:text-flame"
      >
        <MapPin className="w-4 h-4 text-flame shrink-0" />
        <span className="underline underline-offset-2">{o.address}</span>
      </a>
      {showStatus && (
        <span
          className={`inline-block mt-2 px-2 py-0.5 rounded border text-[11px] font-semibold ${STATUS_META[o.status]?.badge || ""}`}
        >
          {STATUS_META[o.status]?.emoji} {STATUS_META[o.status]?.label}
        </span>
      )}
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

export function EmptyState({ text }) {
  return (
    <div className="border border-dashed border-[#723645]/60 rounded-lg p-6 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}
