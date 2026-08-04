import { Plus, X } from "lucide-react";

export const WEEK_DAYS = [
  { key: "mon", label: "Δευτέρα" },
  { key: "tue", label: "Τρίτη" },
  { key: "wed", label: "Τετάρτη" },
  { key: "thu", label: "Πέμπτη" },
  { key: "fri", label: "Παρασκευή" },
  { key: "sat", label: "Σάββατο" },
  { key: "sun", label: "Κυριακή" },
];

export const emptyDay = () => ({ closed: false, ranges: [] });

const timeInputCls =
  "h-9 w-[86px] px-2 rounded-md bg-[#2A0E14] border border-[#723645] focus:border-flame outline-none text-sm font-mono text-center";

// Ωράριο ανά ημέρα — controlled: value = { mon: {closed, ranges:[{start,end}]}, ... }
export default function StoreHoursEditor({ value, onChange }) {
  const day = (key) => value?.[key] || emptyDay();

  const setDay = (key, patch) =>
    onChange({ ...(value || {}), [key]: { ...day(key), ...patch } });

  const setRange = (key, idx, patch) => {
    const d = day(key);
    setDay(key, {
      ranges: d.ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });
  };

  const addRange = (key) => {
    const d = day(key);
    if (d.ranges.length >= 2) return;
    setDay(key, {
      closed: false,
      ranges: [...d.ranges, { start: "12:00", end: "23:00" }],
    });
  };

  const removeRange = (key, idx) =>
    setDay(key, { ranges: day(key).ranges.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-1.5">
      {WEEK_DAYS.map(({ key, label }) => {
        const d = day(key);
        return (
          <div
            key={key}
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-md bg-[#2A0E14] border border-[#723645]"
            data-testid={`hours-day-${key}`}
          >
            <div className="w-24 text-sm font-semibold shrink-0">{label}</div>

            <label className="flex items-center gap-1.5 text-xs text-neutral-400 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={d.closed}
                onChange={(e) =>
                  setDay(key, { closed: e.target.checked, ranges: e.target.checked ? [] : d.ranges })
                }
                data-testid={`hours-closed-${key}`}
                className="accent-[#E8590C]"
              />
              Κλειστά
            </label>

            {!d.closed && (
              <div className="flex flex-wrap items-center gap-2">
                {d.ranges.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={r.start}
                      onChange={(e) => setRange(key, idx, { start: e.target.value })}
                      data-testid={`hours-${key}-${idx}-start`}
                      className={timeInputCls}
                    />
                    <span className="text-neutral-500 text-xs">–</span>
                    <input
                      type="time"
                      value={r.end}
                      onChange={(e) => setRange(key, idx, { end: e.target.value })}
                      data-testid={`hours-${key}-${idx}-end`}
                      className={timeInputCls}
                    />
                    <button
                      type="button"
                      onClick={() => removeRange(key, idx)}
                      className="p-1 text-neutral-500 hover:text-[#FF6961]"
                      title="Αφαίρεση"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {d.ranges.length < 2 && (
                  <button
                    type="button"
                    onClick={() => addRange(key)}
                    data-testid={`hours-add-${key}`}
                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-flame px-1.5 py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {d.ranges.length === 0 ? "Ωράριο" : "2η βάρδια"}
                  </button>
                )}
                {d.ranges.length === 0 && (
                  <span className="text-xs text-neutral-600">— δεν έχει οριστεί</span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-neutral-500 pt-1">
        Για βραδινό που κλείνει μετά τα μεσάνυχτα (π.χ. 19:00–01:00), βάλτε ώρα λήξης μικρότερη από την έναρξη.
      </p>
    </div>
  );
}
