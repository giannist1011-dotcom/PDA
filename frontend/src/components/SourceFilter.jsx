import { SOURCE_OPTIONS } from "@/lib/platforms";

// Φίλτρο προέλευσης: Όλα (all-around) / Ταμείο / efood / Box / Wolt.
// Οι πλατφόρμες εμφανίζονται μόνο όσες είναι ενεργές στο κατάστημα.
export default function SourceFilter({ value, onChange, enabledPlatforms = [], testIdPrefix = "source" }) {
  const options = SOURCE_OPTIONS.filter(
    (o) => o.key === "all" || o.key === "pos" || enabledPlatforms.includes(o.key)
  );
  if (options.length <= 2) return null; // καμία ενεργή πλατφόρμα → δεν έχει νόημα
  return (
    <div className="flex flex-col gap-1" data-testid={`${testIdPrefix}-filter`}>
      <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        Προέλευση
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              data-testid={`${testIdPrefix}-${o.key}`}
              data-state={active ? "on" : "off"}
              className={`h-11 px-4 rounded-md border text-sm font-bold transition-colors no-select ${
                active
                  ? "bg-flame text-white border-flame"
                  : "bg-[#2A0E14] text-neutral-300 border-[#723645] hover:border-flame"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
