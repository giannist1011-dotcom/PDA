import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------- Επιλογή παραλλαγών είδους ελλείψεων ----------
// Μικρό φύλλο επιλογών, όπως η παραμετροποίηση προϊόντος: πολλαπλή επιλογή
// (π.χ. Σακούλες → 35άρες + 45άρες) και επιβεβαίωση. Ξανά tap = διόρθωση.
export default function VariantPickerModal({ open, item, onClose, onConfirm }) {
  const [selected, setSelected] = useState([]);
  const variants = item?.variants || [];

  useEffect(() => {
    if (open) setSelected(item?.selected_variant_ids || []);
  }, [open, item]);

  if (!open || !item) return null;

  const toggle = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((v) => v !== id) : [...p, id]));

  const confirm = () => {
    // Η σειρά που τυπώνεται είναι πάντα η σειρά που όρισε ο ιδιοκτήτης
    onConfirm(variants.filter((v) => selected.includes(v.id)).map((v) => v.id));
    onClose();
  };

  const allSelected = variants.length > 0 && selected.length === variants.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="stock-variant-modal"
      onClick={onClose}
    >
      <div
        className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-xl font-bold">{item.name}</h3>
        <p className="text-sm text-neutral-400 mt-1 mb-4">
          Ποιες παραλλαγές λείπουν; (μπορείτε να επιλέξετε πολλές)
        </p>

        <button
          type="button"
          onClick={() => setSelected(allSelected ? [] : variants.map((v) => v.id))}
          data-testid="stock-variant-select-all"
          className="self-start mb-3 h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider border bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
        >
          {allSelected ? "Καθαρισμός" : "Επιλογή όλων"}
        </button>

        <div className="space-y-2 overflow-y-auto flex-1 -mx-1 px-1">
          {variants.map((v) => {
            const on = selected.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                data-testid={`stock-variant-${v.id}`}
                aria-checked={on}
                role="checkbox"
                className={`w-full p-3 rounded-lg border flex items-center gap-3 text-left transition-colors ${
                  on
                    ? "border-flame bg-flame/10"
                    : "border-[#723645] bg-[#2A0E14] hover:border-[#7A3E52]"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    on ? "bg-brand border-brand" : "border-[#7A3E52]"
                  }`}
                >
                  {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </span>
                <span className="font-heading font-semibold text-sm text-white truncate">
                  {v.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-variant-cancel"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
          >
            Άκυρο
          </button>
          <Button
            type="button"
            onClick={confirm}
            data-testid="stock-variant-confirm"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            {selected.length === 0
              ? "Αφαίρεση από τη λίστα"
              : `Στη λίστα (${selected.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
