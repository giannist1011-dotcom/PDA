import { useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Phone,
  StickyNote,
  Timer,
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
import { STATUS_META, ageColorClass, fmtTime, minutesSince, mapsUrl, PROBLEM_LABELS } from "./utils";

// Κάρτα παραγγελίας στον πίνακα διαχείρισης. Η διαχείριση ΕΠΟΠΤΕΥΕΙ:
// οι οδηγοί κάνουν claim μόνοι τους — η απευθείας ανάθεση («Δώσε σε...») είναι
// μικρή δευτερεύουσα ενέργεια για ειδικές περιπτώσεις, όχι βασική ροή.
// storeMode (FleetDeck καταστήματος): ίδια κάρτα, μόνη ενέργεια η ακύρωση
// (onCancel) — τίτλος η εταιρεία διανομής αντί για το κατάστημα παραλαβής.
export default function OrderCard({
  order,
  drivers = [],
  city,
  onChanged,
  storeMode = false,
  onCancel = null,
}) {
  const [busy, setBusy] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const active = !["delivered", "cancelled"].includes(order.status);
  const scheduled = order.status === "scheduled";
  const onShift = drivers.filter((d) => d.on_shift);
  const meta = STATUS_META[order.status] || STATUS_META.waiting;
  // ⏱ ηλικία από την καταχώρηση — live με το polling. Σε παραδομένες: συνολική
  // διάρκεια μέχρι την παράδοση (στατική, ουδέτερο χρώμα). Σε προγραμματισμένες
  // δεν τρέχει χρονόμετρο — φαίνεται η ώρα δημοσίευσης.
  const mins = scheduled
    ? null
    : active
      ? minutesSince(order.created_at)
      : order.status === "delivered" && order.delivered_at
        ? Math.max(0, Math.round((new Date(order.delivered_at) - new Date(order.created_at)) / 60000))
        : null;

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
      {/* Πάνω αριστερά: κατάσταση (χρωματιστή κουκκίδα + label) + αριθμός.
          Πάνω δεξιά: ⏱ λεπτά από την καταχώρηση (χρώματα όπως στην εφ. οδηγού) */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.dot }} />
          <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
        </span>
        {order.number != null && <span className="font-bold shrink-0">#{order.number}</span>}
        {order.urgent && active && <Zap className="w-4 h-4 text-gold shrink-0" />}
        {scheduled && order.publish_at && (
          <span
            className="ml-auto flex items-center gap-0.5 text-xs font-bold shrink-0 text-[#C9A8FF]"
            data-testid={`fleet-publish-at-${order.id}`}
          >
            <Timer className="w-3.5 h-3.5" /> {fmtTime(order.publish_at)}
          </span>
        )}
        {mins !== null && (
          <span
            className={`ml-auto flex items-center gap-0.5 text-xs font-bold shrink-0 ${
              active ? ageColorClass(mins) : "text-neutral-500"
            }`}
            data-testid={`fleet-age-${order.id}`}
          >
            <Timer className="w-3.5 h-3.5" /> {mins}'
          </span>
        )}
      </div>
      <div className="mt-2 truncate text-neutral-200 font-semibold">
        {storeMode ? order.team_name || "—" : order.pickup_name}
      </div>
      <a
        href={mapsUrl(order.address, city)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 mt-1 text-neutral-300 hover:text-white"
      >
        <MapPin className="w-3.5 h-3.5 text-flame shrink-0" />
        <span className="truncate">{order.address}</span>
      </a>
      <div className="mt-1 text-xs text-neutral-400 truncate">
        🛵 {order.driver_name || "—"}
      </div>
      {order.phone && (
        <a
          href={`tel:${order.phone}`}
          className="flex items-center gap-1.5 mt-1 text-xs text-neutral-400 hover:text-white"
          data-testid={`fleet-phone-${order.id}`}
        >
          <Phone className="w-3.5 h-3.5 shrink-0" />
          {order.phone}
        </a>
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

      {/* Κατάστημα: μόνη ενέργεια η ακύρωση — πριν το claim σιωπηλή αφαίρεση,
          μετά ειδοποιείται οδηγός + διαχείριση (server-side κανόνες) */}
      {active && storeMode && (
        <div className="mt-2 pt-2 border-t border-[#723645]/60 flex justify-end">
          <button
            disabled={busy}
            onClick={() =>
              run(
                () => onCancel(order),
                scheduled
                  ? "Ακύρωση της προγραμματισμένης παραγγελίας;"
                  : `Ακύρωση της παραγγελίας${order.number != null ? ` #${order.number}` : ""};`
              )
            }
            data-testid={`fleet-store-cancel-${order.id}`}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold text-[#FF6961] hover:bg-white/5 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Ακύρωση
          </button>
        </div>
      )}

      {active && !storeMode && (
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
