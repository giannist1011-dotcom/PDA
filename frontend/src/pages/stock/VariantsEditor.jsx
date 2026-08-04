import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// ---------- Παραλλαγές είδους: απλή λίστα (προσθήκη/μετονομασία/σειρά/διαγραφή) ----------
// value: [{ id?, name }] — τα υπάρχοντα ids διατηρούνται ώστε να μη χάνονται οι
// ήδη επιλεγμένες παραλλαγές όταν ο ιδιοκτήτης προσθέτει καινούριες.
export default function VariantsEditor({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const list = value || [];

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (list.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...list, { name }]);
    setDraft("");
  };

  const rename = (idx, name) =>
    onChange(list.map((v, i) => (i === idx ? { ...v, name } : v)));

  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));

  const iconBtn =
    "p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400";

  return (
    <div data-testid="stock-variants-editor">
      <label className="text-xs uppercase tracking-wider text-neutral-400">
        Παραλλαγές (προαιρετικό)
      </label>
      <p className="text-[11px] text-neutral-500 mt-1 mb-2">
        Π.χ. Σακούλες → 35άρες / 40άρες / 45άρες. Χωρίς παραλλαγές, το είδος
        επιλέγεται με ένα tap.
      </p>

      {list.length > 0 && (
        <div className="space-y-2 mb-2">
          {list.map((v, idx) => (
            <div key={v.id || `new-${idx}`} className="flex items-center gap-1">
              <input
                value={v.name}
                onChange={(e) => rename(idx, e.target.value)}
                data-testid={`stock-variant-input-${idx}`}
                className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
              />
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                data-testid={`stock-variant-up-${idx}`}
                className={iconBtn}
                title="Πάνω"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === list.length - 1}
                data-testid={`stock-variant-down-${idx}`}
                className={iconBtn}
                title="Κάτω"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                data-testid={`stock-variant-remove-${idx}`}
                className="p-1.5 text-neutral-400 hover:text-[#FF3B30]"
                title="Διαγραφή παραλλαγής"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="π.χ. 35άρες"
          data-testid="stock-variant-new-input"
          className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <button
          type="button"
          onClick={add}
          data-testid="stock-variant-add-btn"
          className="h-10 px-3 rounded-md bg-[#4F202D] text-neutral-200 hover:bg-[#723645] flex items-center"
          title="Προσθήκη παραλλαγής"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
