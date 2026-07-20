import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Option groups editor
export default function OptionGroupsEditor({
  form,
  addGroup,
  updateGroup,
  removeGroup,
  addOption,
  removeOption,
  updateOption,
}) {
  return (
    <div className="border-t border-[#431A25] pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-heading font-bold text-sm">Ομάδες επιλογών</div>
          <div className="text-xs text-neutral-500">
            Π.χ. Μέγεθος, Έξτρα υλικά. Δουλεύουν σε οποιοδήποτε προϊόν.
          </div>
        </div>
        <Button
          type="button"
          onClick={addGroup}
          data-testid="add-option-group-btn"
          className="h-9 bg-[#3D1620] border border-[#723645] hover:border-flame text-white text-sm"
        >
          <Plus className="w-4 h-4 mr-1" /> Ομάδα
        </Button>
      </div>

      {(form.option_groups || []).map((g, gi) => (
        <div
          key={g.id}
          data-testid={`option-group-${gi}`}
          className="mt-3 p-3 bg-[#3D1620] border border-[#723645] rounded-md space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={g.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
              placeholder="Όνομα ομάδας (π.χ. Μέγεθος)"
              data-testid={`group-name-${gi}`}
              className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            />
            <select
              value={g.type}
              onChange={(e) => updateGroup(gi, { type: e.target.value })}
              data-testid={`group-type-${gi}`}
              className="h-10 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none"
            >
              <option value="single">Μία</option>
              <option value="multi">Πολλές</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={!!g.required}
                onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                data-testid={`group-required-${gi}`}
              />
              Υποχρ.
            </label>
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              data-testid={`remove-group-${gi}`}
              className="p-2 text-neutral-500 hover:text-[#FF3B30]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 shrink-0">
              Τύπος τιμής
            </label>
            <select
              value={g.price_mode || "add"}
              onChange={(e) => updateGroup(gi, { price_mode: e.target.value })}
              data-testid={`group-price-mode-${gi}`}
              className="flex-1 h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-xs focus:outline-none focus:border-flame"
            >
              <option value="add">Προσαύξηση (+€ πάνω στη βάση)</option>
              <option value="replace">Καθορισμός τιμής (αντικαθιστά τη βασική)</option>
            </select>
          </div>
          {g.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                value={o.name}
                onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                placeholder="Επιλογή"
                data-testid={`option-name-${gi}-${oi}`}
                className="flex-1 h-9 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
              />
              <input
                type="number"
                step="0.10"
                min="0"
                value={o.price}
                onChange={(e) => updateOption(gi, oi, { price: e.target.value })}
                placeholder="+€"
                data-testid={`option-price-${gi}-${oi}`}
                className="w-24 h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm font-mono focus:outline-none focus:border-flame"
              />
              <button
                type="button"
                onClick={() => removeOption(gi, oi)}
                data-testid={`remove-option-${gi}-${oi}`}
                className="p-1 text-neutral-500 hover:text-[#FF3B30]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() => addOption(gi)}
            data-testid={`add-option-${gi}`}
            className="h-8 bg-transparent border border-dashed border-[#6B3345] hover:border-flame text-neutral-400 hover:text-white text-xs w-full"
          >
            <Plus className="w-3 h-3 mr-1" /> Προσθήκη επιλογής
          </Button>
        </div>
      ))}
    </div>
  );
}
