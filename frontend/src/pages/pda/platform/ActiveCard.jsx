import { useState } from "react";
import { toast } from "sonner";
import { Bike, CheckCheck, Printer } from "lucide-react";
import { formatApiError } from "@/lib/api";
import { platformById } from "@/lib/platforms";
import Countdown from "@/components/platform/Countdown";
import ReadyTimePicker from "@/components/platform/ReadyTimePicker";
import PlatformOrderBody from "@/components/platform/PlatformOrderBody";

// Αποδεκτή παραγγελία: countdown πάνω δεξιά, μεγάλο «ΚΑΘ' ΟΔΟΝ», και μετά
// ολοκλήρωση. Ο χρόνος παράδοσης μπορεί να διορθωθεί όσο είναι σε εξέλιξη.
export default function ActiveCard({ order, onOut, onComplete, onReadyTime, onReprint }) {
  const [busy, setBusy] = useState(false);
  const [editTime, setEditTime] = useState(false);
  const meta = platformById(order.platform);
  const out = order.status === "out_for_delivery";

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
      className="rounded-lg border border-[#723645] bg-[#3D1620] overflow-hidden"
      data-testid={`platform-active-${order.id}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-[#431A25]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold truncate" style={{ color: meta?.accent }}>
            #{order.platform_order_id}
          </span>
          {order.order_number != null && (
            <span className="font-mono text-xs text-neutral-400">
              · POS #{String(order.order_number).padStart(3, "0")}
            </span>
          )}
          {out && (
            <span className="px-1.5 py-0.5 rounded bg-[#3FA9F5]/20 text-[#3FA9F5] text-[9px] font-bold uppercase tracking-widest">
              καθ' οδόν
            </span>
          )}
        </div>
        <Countdown dueAt={order.due_at} testId={`platform-countdown-${order.id}`} />
      </div>

      <div className="p-4 space-y-3">
        <PlatformOrderBody order={order} dense />

        {editTime ? (
          <ReadyTimePicker
            value={order.ready_minutes}
            onChange={(m) => run(async () => {
              await onReadyTime(order.id, m);
              setEditTime(false);
            })}
            compact
            testIdPrefix={`active-ready-${order.id}`}
          />
        ) : (
          <button
            onClick={() => setEditTime(true)}
            data-testid={`platform-edit-time-${order.id}`}
            className="text-xs text-neutral-400 hover:text-flame underline underline-offset-2"
          >
            Αλλαγή χρόνου παράδοσης ({order.ready_minutes}′)
          </button>
        )}

        {!out ? (
          <button
            onClick={() => run(() => onOut(order.id))}
            disabled={busy}
            data-testid={`platform-out-${order.id}`}
            className="w-full h-16 rounded-md bg-brand hover:bg-brand-hover disabled:opacity-60 text-white font-extrabold text-xl tracking-wide flex items-center justify-center gap-3"
          >
            <Bike className="w-7 h-7" />
            ΚΑΘ' ΟΔΟΝ
          </button>
        ) : (
          <button
            onClick={() => run(() => onComplete(order.id))}
            disabled={busy}
            data-testid={`platform-complete-${order.id}`}
            className="w-full h-14 rounded-md bg-[#00A94F] hover:bg-[#00913F] disabled:opacity-60 text-white font-extrabold text-lg flex items-center justify-center gap-2"
          >
            <CheckCheck className="w-6 h-6" />
            ΠΑΡΑΔΟΘΗΚΕ
          </button>
        )}

        {order.order_id && (
          <button
            onClick={() => run(() => onReprint(order))}
            data-testid={`platform-reprint-${order.id}`}
            className="w-full h-10 rounded-md border border-[#723645] hover:border-flame text-neutral-300 hover:text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Επανεκτύπωση
          </button>
        )}
      </div>
    </div>
  );
}
