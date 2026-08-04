import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { formatGRTime } from "@/lib/format";
import { formatApiError } from "@/lib/api";
import { DEFAULT_READY_MINUTES, platformById } from "@/lib/platforms";
import ReadyTimePicker from "@/components/platforms/order/ReadyTimePicker";
import PlatformOrderBody from "@/components/platforms/order/PlatformOrderBody";

// Εισερχόμενη παραγγελία σε αναμονή απάντησης — η πιο έντονη κάρτα της οθόνης.
export default function IncomingCard({ order, onAccept, onReject }) {
  const [minutes, setMinutes] = useState(DEFAULT_READY_MINUTES);
  const [busy, setBusy] = useState(false);
  const meta = platformById(order.platform);

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
      className="rounded-lg border-2 bg-[#3D1620] overflow-hidden"
      style={{ borderColor: meta?.accent || "#723645" }}
      data-testid={`platform-incoming-${order.id}`}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 h-11"
        style={{ backgroundColor: meta?.soft }}
      >
        <span className="font-mono font-bold" style={{ color: meta?.accent }}>
          #{order.platform_order_id}
        </span>
        <span className="text-xs text-neutral-400 font-mono">
          {formatGRTime(order.received_at)}
          {order.is_test && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-gold/20 text-gold text-[9px] font-bold uppercase tracking-widest">
              δοκιμή
            </span>
          )}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <PlatformOrderBody order={order} />

        <ReadyTimePicker
          value={minutes}
          onChange={setMinutes}
          testIdPrefix={`incoming-ready-${order.id}`}
        />

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            onClick={() => run(() => onAccept(order.id, minutes))}
            disabled={busy}
            data-testid={`platform-accept-${order.id}`}
            className="h-14 rounded-md bg-[#00A94F] hover:bg-[#00913F] disabled:opacity-60 text-white font-extrabold text-lg flex items-center justify-center gap-2"
          >
            <Check className="w-6 h-6" />
            ΑΠΟΔΟΧΗ · {minutes}′
          </button>
          <button
            onClick={() => run(() => onReject(order.id))}
            disabled={busy}
            data-testid={`platform-reject-${order.id}`}
            className="h-14 px-5 rounded-md border border-[#FF3B30]/60 text-[#FF6961] hover:bg-[#FF3B30]/10 disabled:opacity-60 font-bold flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            ΑΠΟΡΡΙΨΗ
          </button>
        </div>
      </div>
    </div>
  );
}
