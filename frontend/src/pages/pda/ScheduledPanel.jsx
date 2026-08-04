import { Clock, Printer, Ban, Maximize2 } from "lucide-react";
import { eur } from "@/lib/format";
import { schedDateTime, schedState, sortScheduled, SCHED_META } from "./utils";

// Μόνιμη περιοχή «Προγραμματισμένες» πάνω από το μενού: όλες οι επόμενες με την
// ώρα τους (πιο κοντινή πρώτη). Όσες έφτασε η ώρα τους μένουν εδώ ως υπενθύμιση
// (χρυσό «ΩΡΑ ΤΗΣ: τώρα» + επανεκτύπωση)· οι εκπρόθεσμες με κόκκινο.
export default function ScheduledPanel({ orders, onPrintNow, onCancel, onOpenAll }) {
  if (!orders?.length) return null;
  const list = sortScheduled(orders);
  const dueCount = list.filter((o) => ["now", "late"].includes(schedState(o))).length;

  return (
    <section
      data-testid="scheduled-panel"
      className="mt-2 mb-3 shrink-0 rounded-lg border border-[#00B0FF]/40 bg-[#00B0FF]/5 overflow-hidden"
    >
      <header className="flex items-center gap-2 px-3 h-10 border-b border-[#00B0FF]/25">
        <Clock className="w-4 h-4 text-[#00B0FF] shrink-0" />
        <span className="font-heading font-bold text-sm text-[#00B0FF]">Προγραμματισμένες</span>
        <span className="px-1.5 h-5 min-w-[20px] rounded bg-[#00B0FF]/20 text-[#00B0FF] text-xs font-bold flex items-center justify-center">
          {list.length}
        </span>
        {dueCount > 0 && (
          <span className="text-xs font-bold text-gold" data-testid="scheduled-due-count">
            {dueCount} για τώρα
          </span>
        )}
        <button
          onClick={onOpenAll}
          data-testid="scheduled-panel-open-all"
          className="ml-auto flex items-center gap-1 h-7 px-2 rounded-md border border-[#00B0FF]/40 text-[#00B0FF] text-xs font-bold hover:bg-[#00B0FF]/10"
        >
          <Maximize2 className="w-3 h-3" /> Όλες
        </button>
      </header>
      <ul className="max-h-[34vh] overflow-y-auto p-2 space-y-2">
        {list.map((o) => {
          const st = schedState(o);
          const meta = SCHED_META[st];
          return (
            <li
              key={o.id}
              data-testid={`scheduled-panel-item-${o.id}`}
              data-state={st}
              className={`p-2 rounded-md border ${meta.box}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-mono text-lg font-bold shrink-0 ${meta.text}`}>
                  {schedDateTime(o.scheduled_at)}
                </span>
                {meta.label && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${meta.text}`}>
                    {meta.label}
                  </span>
                )}
                <span className="text-sm text-white font-semibold truncate">
                  #{String(o.order_number).padStart(3, "0")}
                  {o.delivery?.name ? ` · ${o.delivery.name}` : ""}
                </span>
                <span className="ml-auto font-mono text-sm font-bold text-white shrink-0">
                  {eur(o.total)}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => onPrintNow(o)}
                  data-testid={`scheduled-panel-print-${o.id}`}
                  className="flex-1 h-9 rounded-md bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> {meta.action}
                </button>
                {o.status === "scheduled" && (
                  <button
                    onClick={() => onCancel(o)}
                    data-testid={`scheduled-panel-cancel-${o.id}`}
                    className="h-9 px-3 rounded-md border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" /> Ακύρωση
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
