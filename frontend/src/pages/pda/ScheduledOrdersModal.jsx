import { Clock, X, Printer, Ban, Phone as PhoneIcon } from "lucide-react";
import { eur } from "@/lib/format";
import { schedDateTime } from "./utils";

export default function ScheduledOrdersModal({ open, orders, onClose, onPrintNow, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="scheduled-orders-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#431A25]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#00B0FF]" />
            <h3 className="font-heading text-xl font-bold">Προγραμματισμένες παραγγελίες</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="scheduled-modal-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {orders.length === 0 ? (
            <div className="text-neutral-500 text-center py-10">
              Δεν υπάρχουν προγραμματισμένες παραγγελίες
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  data-testid={`scheduled-order-${o.id}`}
                  className="p-4 bg-[#2A0E14] border border-[#00B0FF]/40 rounded-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-mono text-xl font-bold text-[#00B0FF] shrink-0">
                        {schedDateTime(o.scheduled_at)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-semibold text-sm truncate">
                          #{String(o.order_number).padStart(3, "0")}
                          {o.delivery?.name ? ` · ${o.delivery.name}` : ""}
                        </div>
                        {o.delivery?.phone && (
                          <div className="flex items-center gap-1 text-xs text-neutral-400">
                            <PhoneIcon className="w-3 h-3" /> {o.delivery.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white shrink-0">{eur(o.total)}</div>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 leading-snug">
                    {o.items.map((it) => `${it.quantity}x ${it.name}`).join(" · ")}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onPrintNow(o)}
                      data-testid={`scheduled-print-now-${o.id}`}
                      className="flex-1 h-10 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Τύπωσε τώρα
                    </button>
                    <button
                      onClick={() => onCancel(o)}
                      data-testid={`scheduled-cancel-${o.id}`}
                      className="h-10 px-4 rounded-md border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Ban className="w-4 h-4" /> Ακύρωση
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
