import { useState } from "react";
import { toast } from "sonner";
import { MapPin, StickyNote, XCircle, RotateCcw, CheckCircle2 } from "lucide-react";
import { apiFleetAssignOrder, apiFleetOrderStatus, apiFleetCancelOrder } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { PAYMENT_LABELS, fmtMoney, fmtTime, mapsUrl } from "./utils";

// Κάρτα παραγγελίας στον πίνακα του συντονιστή: στοιχεία + ενέργειες
// (ανάθεση/αλλαγή οδηγού, επιστροφή σε αναμονή, παράδοση, ακύρωση).
export default function OrderCard({ order, drivers, city, onChanged }) {
  const [busy, setBusy] = useState(false);
  const active = !["delivered", "cancelled"].includes(order.status);

  const run = async (fn, confirmMsg = null) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`bg-[#3D1620] border border-[#723645] rounded-lg p-3 text-sm ${
        order.status === "cancelled" ? "opacity-50" : ""
      }`}
      data-testid={`fleet-order-${order.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold">#{order.number}</span>
        <span className="truncate text-neutral-300">{order.pickup_name}</span>
        <span className="ml-auto text-xs text-neutral-500">{fmtTime(order.created_at)}</span>
      </div>
      <a
        href={mapsUrl(order.address, city)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 mt-1.5 text-neutral-300 hover:text-white"
      >
        <MapPin className="w-3.5 h-3.5 text-flame shrink-0" />
        <span className="truncate">{order.address}</span>
      </a>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="font-semibold text-gold">{fmtMoney(order.amount)}</span>
        <span className="text-xs text-neutral-400">{PAYMENT_LABELS[order.payment]}</span>
        {order.driver_name && (
          <span className="ml-auto text-xs text-neutral-300 truncate">🛵 {order.driver_name}</span>
        )}
      </div>
      {order.notes && (
        <div className="flex items-start gap-1.5 mt-1.5 text-xs text-neutral-400">
          <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{order.notes}</span>
        </div>
      )}

      {active && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#723645]/60">
          <select
            value={order.driver_id || ""}
            disabled={busy}
            onChange={(e) =>
              run(() => apiFleetAssignOrder(order.id, e.target.value || null))
            }
            data-testid={`fleet-assign-${order.id}`}
            className="flex-1 h-8 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-xs text-white focus:outline-none focus:border-flame"
          >
            <option value="">— Χωρίς οδηγό —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {order.status !== "waiting" && (
            <>
              <button
                disabled={busy}
                onClick={() => run(() => apiFleetOrderStatus(order.id, "delivered"))}
                title="Σήμανση ως παραδόθηκε"
                data-testid={`fleet-deliver-${order.id}`}
                className="p-1.5 rounded-md hover:bg-white/5 text-[#5BD778]"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => apiFleetAssignOrder(order.id, null))}
                title="Επιστροφή σε αναμονή"
                data-testid={`fleet-unassign-${order.id}`}
                className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              run(
                () => apiFleetCancelOrder(order.id),
                `Ακύρωση της παραγγελίας #${order.number};`
              )
            }
            title="Ακύρωση"
            data-testid={`fleet-cancel-${order.id}`}
            className="p-1.5 rounded-md hover:bg-white/5 text-[#FF6961]"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
