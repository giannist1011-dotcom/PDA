import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Send, Timer, Package, XCircle, Zap } from "lucide-react";
import { formatApiError, apiStoreFleetCancelOrder, apiStoreFleetPublishNow } from "@/lib/api";
import { STATUS_META, ageColorClass, fmtTime, mapsUrl, minutesSince } from "@/components/fleet/utils";
import { uploadDispatchCard } from "./utils";

// Κάρτα μιας τυπωμένης παραγγελίας ΠΑΡΑΔΟΣΗΣ στην καρτέλα «Αποστολή παραγγελίας».
//
// Πριν το ανέβασμα: αριθμός + διεύθυνση + πλήθος ειδών, μετρητής λεπτών από την
// εκτύπωση πάνω δεξιά, και ένα μεγάλο κουμπί «Αποστολή».
// Μετά το ανέβασμα: κατάσταση 🔴🟡🟢🔵 + διανομέας + χρόνος. Όσο το ανέβασμα
// είναι προγραμματισμένο («Ανέβασμα σε Χ'») δίνονται ακύρωση και άμεση αποστολή.
export default function DispatchCard({ order, teamId, city, canSend, onChanged }) {
  const [busy, setBusy] = useState(false);
  const fleet = order.fleet || null;
  // Μία παραγγελία POS ανεβαίνει ΜΙΑ φορά: και ακυρωμένη να είναι στο FleetDeck,
  // ο σύνδεσμος μένει — δείχνουμε την κατάσταση, όχι ξανά «Αποστολή» (θα έσκαγε).
  const uploaded = !!fleet;
  const scheduled = uploaded && fleet.status === "scheduled";
  const meta = uploaded ? STATUS_META[fleet.status] || STATUS_META.waiting : null;

  // ⏱ λεπτά από την ΕΚΤΥΠΩΣΗ (δημιουργία της παραγγελίας POS) — ίδια χρώματα
  // με τον πίνακα της εταιρείας: >15' χρυσό, >25' κόκκινο
  const mins = minutesSince(order.created_at);
  // Λεπτά μέχρι την προγραμματισμένη δημοσίευση (στρογγυλοποίηση προς τα πάνω)
  const untilPublish = scheduled && fleet.publish_at
    ? Math.max(0, Math.ceil((new Date(fleet.publish_at).getTime() - Date.now()) / 60000))
    : null;

  const run = async (fn, confirmMsg = null) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      await uploadDispatchCard(order, { teamId, city, delayMinutes: 0 });
      toast.success(`Η #${String(order.order_number).padStart(3, "0")} στάλθηκε στους διανομείς`);
    });

  return (
    <div
      className={`bg-[#3D1620] border rounded-lg p-3 text-sm flex flex-col ${
        uploaded ? "border-[#723645]" : "border-flame/50"
      }`}
      data-testid={`dispatch-card-${order.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-white shrink-0">
          #{String(order.order_number ?? 0).padStart(3, "0")}
        </span>
        {order.platform && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 shrink-0">
            {order.platform}
          </span>
        )}
        <span
          className={`ml-auto flex items-center gap-1 text-xs font-bold shrink-0 ${ageColorClass(mins)}`}
          data-testid={`dispatch-age-${order.id}`}
          title="Λεπτά από την εκτύπωση"
        >
          <Timer className="w-3.5 h-3.5" /> {mins}'
        </span>
      </div>

      <a
        href={mapsUrl(order.address, city)}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-1.5 mt-2 text-neutral-200 hover:text-white"
      >
        <MapPin className="w-4 h-4 text-flame shrink-0 mt-0.5" />
        <span className="font-semibold leading-tight">
          {order.address || "—"}
          {order.floor && (
            <span className="block text-xs font-normal text-neutral-400">
              Όροφος: {order.floor}
            </span>
          )}
        </span>
      </a>

      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-400">
        <Package className="w-3.5 h-3.5 shrink-0" />
        {order.items_count} {order.items_count === 1 ? "είδος" : "είδη"}
        {order.customer_name && <span className="truncate">· {order.customer_name}</span>}
      </div>

      <div className="mt-3 pt-3 border-t border-[#723645]/60">
        {!uploaded ? (
          <>
            <button
              onClick={send}
              disabled={busy || !canSend}
              data-testid={`dispatch-send-${order.id}`}
              className="w-full h-12 rounded-md bg-brand hover:bg-brand-hover text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {busy ? "Αποστολή..." : "Αποστολή"}
            </button>
            {!canSend && (
              <div className="mt-1.5 text-[11px] text-neutral-500 text-center">
                Χωρίς ενεργή συνεργασία με εταιρεία διανομής
              </div>
            )}
          </>
        ) : scheduled ? (
          <>
            <div
              className="flex items-center gap-1.5 text-sm font-bold text-[#C9A8FF]"
              data-testid={`dispatch-scheduled-${order.id}`}
            >
              <Timer className="w-4 h-4 shrink-0" />
              Ανέβασμα σε {untilPublish}′
              <span className="ml-auto text-xs font-normal text-neutral-400">
                {fmtTime(fleet.publish_at)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => apiStoreFleetCancelOrder(fleet.id),
                    "Ακύρωση του προγραμματισμένου ανεβάσματος;"
                  )
                }
                data-testid={`dispatch-cancel-${order.id}`}
                className="h-10 rounded-md border border-[#723645] text-xs font-bold text-[#FF6961] hover:bg-white/5 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Ακύρωση
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await apiStoreFleetPublishNow(fleet.id);
                    toast.success("Στάλθηκε στους διανομείς");
                  })
                }
                data-testid={`dispatch-publish-now-${order.id}`}
                className="h-10 rounded-md bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" /> Άμεση αποστολή
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2" data-testid={`dispatch-status-${order.id}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.dot }} />
            <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
            {fleet.number != null && (
              <span className="text-xs text-neutral-500 shrink-0">#{fleet.number}</span>
            )}
            <span className="ml-auto text-xs text-neutral-400 truncate">
              🛵 {fleet.driver_name || "—"}
            </span>
          </div>
        )}
        {uploaded && !scheduled && fleet.team_name && (
          <div className="mt-1 text-[11px] text-neutral-500 truncate">{fleet.team_name}</div>
        )}
      </div>
    </div>
  );
}
