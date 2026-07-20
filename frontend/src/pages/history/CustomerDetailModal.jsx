import { X, Phone, MapPin } from "lucide-react";
import { eur, formatGRDateTime } from "@/lib/format";

// ---------- Customer detail modal ----------
export default function CustomerDetailModal({ customer, onClose, onOpenOrder }) {
  if (!customer) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="customer-detail-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-[#431A25]">
          <div>
            <h3 className="font-heading text-xl font-bold">
              {customer.name || "Χωρίς όνομα"}
            </h3>
            <div className="text-sm text-neutral-400 mt-1 space-y-0.5">
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-flame" /> {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-flame" />
                  {customer.address}
                  {customer.floor ? ` · Όροφος: ${customer.floor}` : ""}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="customer-detail-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Παραγγελίες
              </div>
              <div className="font-mono text-xl font-bold text-white mt-0.5">
                {customer.orders_count}
              </div>
            </div>
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Συνολικά έσοδα
              </div>
              <div className="font-mono text-xl font-bold text-gold mt-0.5">
                {eur(customer.total_spent)}
              </div>
            </div>
          </div>

          {customer.top_items?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                Τα συνηθισμένα του
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.top_items.map((it) => (
                  <span
                    key={it.name}
                    className="px-3 py-1.5 bg-[#2A0E14] border border-[#723645] rounded-md text-sm"
                  >
                    <span className="text-white">{it.name}</span>
                    <span className="font-mono text-gold font-bold ml-2">
                      ×{it.quantity}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
              Ιστορικό παραγγελιών
            </div>
            <ul className="space-y-2">
              {customer.orders.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => onOpenOrder(o.id)}
                    data-testid={`customer-order-${o.id}`}
                    className="w-full flex items-center justify-between gap-3 p-3 bg-[#2A0E14] border border-[#723645] rounded-md hover:border-flame text-left transition-colors"
                  >
                    <div>
                      <div className="text-white font-semibold text-sm">
                        #{String(o.order_number).padStart(3, "0")}
                        <span className="text-neutral-500 font-normal ml-2">
                          {o.delivery_type === "delivery" ? "Παράδοση" : "Takeaway"}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {formatGRDateTime(o.created_at)}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eur(o.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
