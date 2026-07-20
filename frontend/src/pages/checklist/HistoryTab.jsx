import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { apiChecklistHistory } from "@/lib/api";
import { formatGRTime } from "@/lib/format";
import { LIST_META } from "./utils";

const fmtDateGR = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("el-GR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
};

// ---------- Ιστορικό (owner) ----------
export default function HistoryTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiChecklistHistory(14)
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error)
    return <div className="text-[#FF3B30] p-4">Σφάλμα φόρτωσης ιστορικού</div>;
  if (!data) return <div className="text-neutral-500 p-4">Φόρτωση…</div>;
  if (data.days.length === 0)
    return (
      <div className="py-12 text-center text-neutral-500">
        Δεν υπάρχει ακόμη ιστορικό — θα εμφανιστεί μόλις τικαριστούν εργασίες.
      </div>
    );

  return (
    <div className="space-y-4">
      {data.days.map((day) => (
        <div
          key={day.date}
          className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden"
          data-testid={`checklist-history-${day.date}`}
        >
          <div className="px-4 py-3 border-b border-[#723645] font-heading font-semibold capitalize">
            {fmtDateGR(day.date)}
            <span className="ml-2 font-mono text-xs text-neutral-500">{day.date}</span>
          </div>
          <div className="divide-y divide-[#431A25]">
            {["open", "close"].map((list) => {
              const ticks = day.ticks.filter((t) => t.list === list);
              const missing = day.missing.filter((m) => m.list === list);
              if (ticks.length === 0 && missing.length === 0) return null;
              const meta = LIST_META[list];
              const Icon = meta.icon;
              return (
                <div key={list} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-300 mb-2">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                    {meta.label}
                    <span className="font-mono text-xs text-neutral-500">
                      {ticks.length}/{ticks.length + missing.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ticks.map((t) => (
                      <div key={t.template_id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                        <span className="text-neutral-200 flex-1 min-w-0">{t.text}</span>
                        <span className="text-xs text-neutral-500 shrink-0">
                          {t.by} · {formatGRTime(t.at)}
                        </span>
                      </div>
                    ))}
                    {missing.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 text-sm">
                        <Circle className="w-4 h-4 text-[#FF6961] shrink-0 mt-0.5" />
                        <span className="text-neutral-500 flex-1 min-w-0">{m.text}</span>
                        <span className="text-xs text-[#FF6961] shrink-0 font-bold">
                          Δεν έγινε
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
