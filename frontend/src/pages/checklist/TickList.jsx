import { CheckCircle2, Circle, CalendarClock } from "lucide-react";
import { formatGRTime } from "@/lib/format";
import { LIST_META, fmtShortDateGR } from "./utils";

// ---------- Λίστα χρήσης (τικάρισμα) ----------
export default function TickList({ list, items, onTick, busyId }) {
  const meta = LIST_META[list];
  const Icon = meta.icon;
  const done = items.filter((i) => i.done).length;
  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#723645]">
        <div className="flex items-center gap-2 font-heading font-semibold text-lg">
          <Icon className={`w-5 h-5 ${meta.color}`} />
          {meta.label}
        </div>
        <span
          className={`font-mono text-sm font-bold ${
            items.length > 0 && done === items.length ? "text-[#00E676]" : "text-neutral-400"
          }`}
          data-testid={`checklist-count-${list}`}
        >
          {done}/{items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-sm px-4">
          Δεν έχουν οριστεί εργασίες. Ο ιδιοκτήτης τις προσθέτει από τη «Διαχείριση».
        </div>
      ) : (
        <div className="divide-y divide-[#431A25]">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onTick(it)}
              disabled={busyId === it.id}
              data-testid={`checklist-item-${it.id}`}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[#4A1B27] transition-colors disabled:opacity-60"
            >
              {it.done ? (
                <CheckCircle2 className="w-6 h-6 text-[#00E676] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-6 h-6 text-neutral-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold flex items-center gap-2 flex-wrap ${
                    it.done ? "text-neutral-400 line-through" : "text-white"
                  }`}
                >
                  <span className="min-w-0">{it.text}</span>
                  {it.date && (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold no-underline"
                      title={`Έκτακτη εργασία — μόνο σήμερα (${fmtShortDateGR(it.date)})`}
                      data-testid={`checklist-oneoff-tick-badge-${it.id}`}
                    >
                      <CalendarClock className="w-3 h-3" />
                      Έκτακτη
                    </span>
                  )}
                </div>
                {it.done && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {it.done_by} · {formatGRTime(it.done_at)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
