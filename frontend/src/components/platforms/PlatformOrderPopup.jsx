// Καθολικό popup νέας παραγγελίας πλατφόρμας: εμφανίζεται πάνω δεξιά σε ΟΠΟΙΑΔΗΠΟΤΕ
// οθόνη, είναι πλήρως λειτουργικό (ΑΠΟΔΟΧΗ με χρόνο παράδοσης ή ΑΠΟΡΡΙΨΗ) και
// ΔΕΝ κλείνει μόνο του — μένει μέχρι να απαντηθεί η παραγγελία.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Check, X } from "lucide-react";
import { usePlatformOrders } from "@/context/platforms/PlatformOrdersContext";
import { DEFAULT_READY_MINUTES, platformById } from "@/lib/platforms";
import { formatApiError } from "@/lib/api";
import ReadyTimePicker from "@/components/platforms/order/ReadyTimePicker";
import PlatformOrderBody from "@/components/platforms/order/PlatformOrderBody";

export default function PlatformOrderPopup() {
  const { popupOrder, accept, reject, pending } = usePlatformOrders();
  const [minutes, setMinutes] = useState(DEFAULT_READY_MINUTES);
  const [busy, setBusy] = useState(false);

  // Νέα παραγγελία στο popup → επαναφορά στον προεπιλεγμένο χρόνο
  useEffect(() => {
    setMinutes(DEFAULT_READY_MINUTES);
  }, [popupOrder?.id]);

  if (!popupOrder) return null;
  const meta = platformById(popupOrder.platform);
  const others = pending.length - 1;

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed z-[60] top-3 right-3 left-3 sm:left-auto sm:w-[380px] max-h-[80vh] overflow-y-auto rounded-lg border-2 bg-[#2A0E14] shadow-2xl shadow-black/60"
      style={{ borderColor: meta?.accent || "#723645" }}
      data-testid="platform-popup"
      data-platform={popupOrder.platform}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 h-12 border-b border-[#431A25]"
        style={{ backgroundColor: meta?.soft }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-4 h-4 animate-pulse" style={{ color: meta?.accent }} />
          <span className="font-heading font-bold truncate" style={{ color: meta?.accent }}>
            Νέα παραγγελία · {meta?.label || popupOrder.platform}
          </span>
        </div>
        <span className="font-mono text-xs text-neutral-400 shrink-0">
          #{popupOrder.platform_order_id}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <PlatformOrderBody order={popupOrder} dense />

        <div className="pt-1">
          <ReadyTimePicker
            value={minutes}
            onChange={setMinutes}
            compact
            testIdPrefix="popup-ready"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            onClick={() => run(() => accept(popupOrder.id, minutes))}
            disabled={busy}
            data-testid="platform-popup-accept"
            className="h-12 rounded-md bg-[#00A94F] hover:bg-[#00913F] disabled:opacity-60 text-white font-extrabold flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            ΑΠΟΔΟΧΗ · {minutes}′
          </button>
          <button
            onClick={() => run(() => reject(popupOrder.id))}
            disabled={busy}
            data-testid="platform-popup-reject"
            className="h-12 px-4 rounded-md border border-[#FF3B30]/60 text-[#FF6961] hover:bg-[#FF3B30]/10 disabled:opacity-60 font-bold flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            ΑΠΟΡΡΙΨΗ
          </button>
        </div>

        {others > 0 && (
          <div className="text-xs text-center text-neutral-400" data-testid="platform-popup-queue">
            + {others} ακόμη {others === 1 ? "παραγγελία" : "παραγγελίες"} σε αναμονή
          </div>
        )}
      </div>
    </div>
  );
}
