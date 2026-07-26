import { useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  StickyNote,
  XCircle,
  RotateCcw,
  CheckCircle2,
  Zap,
  Pencil,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import {
  apiFleetAssignOrder,
  apiFleetOrderStatus,
  apiFleetCancelOrder,
  apiFleetSetUrgent,
  apiFleetResolveProblem,
} from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import EditOrderModal from "./EditOrderModal";
import { fmtTime, mapsUrl, PROBLEM_LABELS } from "./utils";

// Κάρτα παραγγελίας στον πίνακα του συντονιστή. Ο συντονιστής ΕΠΟΠΤΕΥΕΙ:
// οι οδηγοί κάνουν claim μόνοι τους — η απευθείας ανάθεση («Δώσε σε...») είναι
// μικρή δευτερεύουσα ενέργεια για ειδικές περιπτώσεις, όχι βασική ροή.
export default function OrderCard({ order, drivers, city, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const active = !["delivered", "cancelled"].includes(order.status);
  const onShift = drivers.filter((d) => d.on_shift);

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

  const iconBtn = "p-1.5 rounded-md hover:bg-white/5 disabled:opacity-50";

  return (
    <div
      className={`bg-[#3D1620] border rounded-lg p-3 text-sm ${
        order.status === "cancelled" ? "opacity-50" : ""
      } ${order.urgent && active ? "border-gold ring-1 ring-gold/40" : "border-[#723645]"}`}
      data-testid={`fleet-order-${order.id}`}
    >
      <div className="flex items-center gap-2">
        {order.urgent && active && <Zap className="w-4 h-4 text-gold shrink-0" />}
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
      {order.driver_name && (
        <div className="mt-1.5 text-xs text-neutral-300 truncate">🛵 {order.driver_name}</div>
      )}
      {order.notes && (
        <div className="flex items-start gap-1.5 mt-1.5 text-xs text-neutral-400">
          <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{order.notes}</span>
        </div>
      )}

      {order.problem && active && (
        <div
          className="mt-2 p-2 rounded-md border border-[#FF3B30]/50 bg-[#FF3B30]/10"
          data-testid={`fleet-problem-flag-${order.id}`}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF6961]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {PROBLEM_LABELS[order.problem.reason] || "Πρόβλημα"}
            <button
              disabled={busy}
              onClick={() => run(() => apiFleetResolveProblem(order.id))}
              data-testid={`fleet-problem-resolve-${order.id}`}
              className="ml-auto px-2 py-0.5 rounded border border-[#FF6961]/50 hover:bg-white/5 font-semibold"
            >
              Επίλυση
            </button>
          </div>
          {order.problem.text && (
            <div className="text-xs text-neutral-300 mt-1">{order.problem.text}</div>
          )}
        </div>
      )}

      {active && (
        <div className="mt-2 pt-2 border-t border-[#723645]/60">
          <div className="flex items-center gap-0.5">
            <button
              disabled={busy}
              onClick={() => run(() => apiFleetSetUrgent(order.id, !order.urgent))}
              title={order.urgent ? "Αφαίρεση επείγοντος" : "⚡ Επείγον — πρώτη στις Ελεύθερες"}
              data-testid={`fleet-urgent-${order.id}`}
              className={`${iconBtn} ${order.urgent ? "text-gold" : "text-neutral-400"}`}
            >
              <Zap className="w-4 h-4" />
            </button>
            <button
              disabled={busy}
              onClick={() => setShowEdit(true)}
              title="Επεξεργασία"
              data-testid={`fleet-edit-${order.id}`}
              className={`${iconBtn} text-neutral-400`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              disabled={busy}
              onClick={() => setShowAssign((v) => !v)}
              title="Δώσε σε... (απευθείας ανάθεση — για ειδικές περιπτώσεις)"
              data-testid={`fleet-assign-toggle-${order.id}`}
              className={`${iconBtn} text-neutral-400`}
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <span className="flex-1" />
            {order.status !== "waiting" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => run(() => apiFleetOrderStatus(order.id, "delivered"))}
                  title="Σήμανση ως παραδόθηκε"
                  data-testid={`fleet-deliver-${order.id}`}
                  className={`${iconBtn} text-[#5BD778]`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => apiFleetAssignOrder(order.id, null))}
                  title="Επιστροφή σε αναμονή"
                  data-testid={`fleet-unassign-${order.id}`}
                  className={`${iconBtn} text-neutral-400`}
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
              className={`${iconBtn} text-[#FF6961]`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          {showAssign && (
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                if (!e.target.value) return;
                setShowAssign(false);
                run(() => apiFleetAssignOrder(order.id, e.target.value));
              }}
              data-testid={`fleet-assign-${order.id}`}
              className="w-full h-8 mt-1.5 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-xs text-white focus:outline-none focus:border-flame"
            >
              <option value="">
                {onShift.length ? "Δώσε σε..." : "Κανένας οδηγός σε βάρδια"}
              </option>
              {onShift.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {showEdit && (
        <EditOrderModal
          order={order}
          city={city}
          onClose={() => setShowEdit(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
