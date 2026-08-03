import { MapPin, Phone, User, StickyNote, CreditCard, Banknote } from "lucide-react";
import { eur } from "@/lib/format";

// Το «σώμα» μιας παραγγελίας πλατφόρμας: είδη με τις επιλογές τους, στοιχεία
// πελάτη και σύνολα. Κοινό σε κάρτα, popup και «Πρόσφατες παραγγελίες».
export default function PlatformOrderBody({ order, dense = false }) {
  const c = order.customer || {};
  return (
    <div className={dense ? "space-y-2" : "space-y-3"}>
      <div className="space-y-1.5">
        {(order.items || []).map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono font-bold text-white mr-1.5">{it.quantity}×</span>
              <span className="text-neutral-100">{it.name}</span>
              {(it.options || []).length > 0 && (
                <div className="text-xs text-neutral-400 pl-6">{it.options.join(" · ")}</div>
              )}
            </div>
            <span className="font-mono text-neutral-300 shrink-0">{eur(it.line_total)}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-[#431A25] text-sm space-y-1">
        {c.name && (
          <div className="flex items-center gap-2 text-neutral-200">
            <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            {c.name}
          </div>
        )}
        {c.phone && (
          <div className="flex items-center gap-2 text-neutral-200">
            <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <a href={`tel:${c.phone}`} className="hover:text-flame font-mono">
              {c.phone}
            </a>
          </div>
        )}
        {order.delivery_type === "delivery" && c.address && (
          <div className="flex items-start gap-2 text-neutral-200">
            <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
            <span>
              {c.address}
              {c.floor ? ` · όροφος ${c.floor}` : ""}
            </span>
          </div>
        )}
        {order.delivery_type === "takeaway" && (
          <div className="text-xs uppercase tracking-widest font-bold text-gold">
            Παραλαβή από το κατάστημα
          </div>
        )}
        {order.note && (
          <div className="flex items-start gap-2 text-gold">
            <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{order.note}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#431A25] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-neutral-400">
          {order.payment === "cash" ? (
            <>
              <Banknote className="w-3.5 h-3.5" /> Μετρητά
            </>
          ) : (
            <>
              <CreditCard className="w-3.5 h-3.5" /> Πληρωμένη (κάρτα)
            </>
          )}
        </span>
        <span className="font-mono text-lg font-bold text-gold">{eur(order.total)}</span>
      </div>
    </div>
  );
}
