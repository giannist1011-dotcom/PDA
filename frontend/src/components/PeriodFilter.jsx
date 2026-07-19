import DatePicker from "@/components/DatePicker";
import { PERIOD_PRESETS, presetRange } from "@/lib/dates";
import { formatGRDate } from "@/lib/format";

// Κοινό φίλτρο περιόδου (Ιστορικό / Στατιστικά / Έξοδα): preset κουμπιά +
// custom Από/Έως με επιλογή από ημερολόγιο (DD/MM/YYYY, όχι πληκτρολόγηση).
// Ελεγχόμενο: value = { preset, from, to } (ISO ημέρες) · onChange(next, meta)
// όπου meta.fromPreset = true όταν η αλλαγή ήρθε από preset (→ άμεση εφαρμογή).
// includeAll: εμφανίζει και το "Πάντα" (χωρίς φίλτρο ημερομηνίας) — μόνο για
// σελίδες με pagination· τα Στατιστικά/Έξοδα φορτώνουν όλη την περίοδο μονομιάς.

export const periodLabel = ({ preset, from, to } = {}) => {
  if (preset === "all" || (!from && !to)) return "Όλο το ιστορικό";
  if (from && !to) return `από ${formatGRDate(from)}`;
  if (!from && to) return `έως ${formatGRDate(to)}`;
  if (from === to) return formatGRDate(from);
  return `${formatGRDate(from)} – ${formatGRDate(to)}`;
};

export default function PeriodFilter({
  value,
  onChange,
  includeAll = false,
  pickerClassName = "h-11 px-3",
  testIdPrefix = "period",
}) {
  const presets = includeAll
    ? PERIOD_PRESETS
    : PERIOD_PRESETS.filter((p) => p.key !== "all");

  const pickPreset = (key) => {
    const r = presetRange(key);
    onChange({ preset: key, from: r?.from || "", to: r?.to || "" }, { fromPreset: true });
  };

  const pickDate = (field, iso) =>
    onChange({ ...value, preset: "custom", [field]: iso }, { fromPreset: false });

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = value?.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => pickPreset(p.key)}
              data-testid={`${testIdPrefix}-preset-${p.key}`}
              data-state={active ? "on" : "off"}
              className={`h-11 px-4 rounded-md text-sm font-bold border transition-colors ${
                active
                  ? "bg-brand border-brand text-white"
                  : "bg-[#4A1B27] border-[#723645] text-neutral-200 hover:border-flame hover:text-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            Από
          </label>
          <DatePicker
            value={value?.from || ""}
            max={value?.to || undefined}
            onChange={(iso) => pickDate("from", iso)}
            testId={`${testIdPrefix}-date-from`}
            className={pickerClassName}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            Έως
          </label>
          <DatePicker
            value={value?.to || ""}
            min={value?.from || undefined}
            onChange={(iso) => pickDate("to", iso)}
            testId={`${testIdPrefix}-date-to`}
            className={pickerClassName}
          />
        </div>
      </div>
    </div>
  );
}
