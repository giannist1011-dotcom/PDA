import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PricedOptionList({ label, hint, rows, setRows, testPrefix }) {
  const update = (idx, patch) =>
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((p) => p.filter((_, i) => i !== idx));
  const add = () => setRows((p) => [...p, { name: "", price: "" }]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          {label}
        </label>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Όνομα επιλογής"
              data-testid={`${testPrefix}-name-${i}`}
              className="flex-1 h-10 px-3 bg-[#3D1620] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            />
            <input
              type="number"
              min="0"
              step="0.10"
              value={r.price}
              onChange={(e) => update(i, { price: e.target.value })}
              placeholder="+€"
              title="Επιπλέον χρέωση (0 = δωρεάν)"
              data-testid={`${testPrefix}-price-${i}`}
              className="w-24 h-10 px-2 bg-[#3D1620] border border-[#723645] rounded-md text-white text-sm font-mono focus:outline-none focus:border-flame"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              data-testid={`${testPrefix}-remove-${i}`}
              className="p-1.5 text-neutral-500 hover:text-[#FF3B30]"
              title="Αφαίρεση"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          onClick={add}
          data-testid={`${testPrefix}-add`}
          className="h-9 bg-transparent border border-dashed border-[#6B3345] hover:border-flame text-neutral-400 hover:text-white text-xs w-full"
        >
          <Plus className="w-3 h-3 mr-1" /> Προσθήκη επιλογής
        </Button>
      </div>
    </div>
  );
}
