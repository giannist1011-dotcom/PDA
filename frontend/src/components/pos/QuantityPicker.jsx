import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { eur } from "@/lib/format";

// Η ποσότητα ρωτιέται ΠΑΝΤΑ πριν μπει το προϊόν στο δελτίο:
// - χωρίς παραμετροποίηση → QuantitySheet (γρήγορο popup, ×1-×4 = άμεση προσθήκη)
// - με παραμετροποίηση → QuantityRow στην κορυφή του sheet επιλογών
// Οι +/- steppers πάνω στις γραμμές του δελτίου μένουν ως δρόμος διόρθωσης.

const QUICK = [1, 2, 3, 4];
const MAX_QTY = 99;
// Ο stepper του γρήγορου popup ξεκινά από το 5 — τα 1-4 είναι ήδη ένα tap μακριά
const STEPPER_START = 5;

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Number(n) || 1));

function Stepper({ value, onChange, prefix }) {
  return (
    <div className="shrink-0 flex items-center gap-1 rounded-lg border border-[#723645] bg-[#3D1620] p-1">
      <button
        type="button"
        onClick={() => onChange(clampQty(value - 1))}
        disabled={value <= 1}
        data-testid={`${prefix}-minus`}
        className="w-11 h-11 rounded-md flex items-center justify-center text-neutral-200 hover:border-flame hover:text-white border border-transparent disabled:opacity-40 no-select active:scale-[0.96]"
      >
        <Minus className="w-5 h-5" />
      </button>
      <span
        data-testid={`${prefix}-value`}
        className="w-9 text-center font-mono text-xl font-bold text-gold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clampQty(value + 1))}
        disabled={value >= MAX_QTY}
        data-testid={`${prefix}-plus`}
        className="w-11 h-11 rounded-md flex items-center justify-center text-neutral-200 hover:border-flame hover:text-white border border-transparent disabled:opacity-40 no-select active:scale-[0.96]"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

// Γραμμή ποσότητας ΣΤΗΝ ΚΟΡΥΦΗ του sheet επιλογών (προϊόντα ΜΕ παραμετροποίηση):
// τα ×1-×4 ΕΠΙΛΕΓΟΥΝ (default ×1) και η προσθήκη γίνεται με το υπάρχον κουμπί
// επιβεβαίωσης — η ποσότητα ορίζεται στην ίδια κίνηση με τις επιλογές.
export function QuantityRow({ value, onChange }) {
  return (
    <section data-testid="quantity-row">
      <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">Ποσότητα</h3>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="grid grid-cols-4 gap-2 sm:gap-3 flex-1 min-w-[13rem]">
          {QUICK.map((n) => {
            const selected = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                data-testid={`quantity-row-x${n}`}
                data-state={selected ? "on" : "off"}
                className={`h-12 rounded-lg border font-mono text-lg font-bold no-select active:scale-[0.98] ${
                  selected
                    ? "border-flame bg-flame/10 text-white"
                    : "border-[#723645] bg-[#3D1620] text-neutral-200 hover:border-[#666]"
                }`}
              >
                ×{n}
              </button>
            );
          })}
        </div>
        <Stepper value={value} onChange={onChange} prefix="quantity-row" />
      </div>
    </section>
  );
}

// Γρήγορο popup ποσότητας για προϊόντα ΧΩΡΙΣ παραμετροποίηση.
// ×1-×4 = προσθήκη με ΕΝΑ tap (κανένα δεύτερο «ΟΚ»), stepper + «Προσθήκη» για
// περισσότερα, tap έξω / Escape = ακύρωση. Χωρίς animations — η ταχύτητα πάνω
// απ' όλα: tap προϊόν → tap ×1 = μέσα.
export default function QuantitySheet({ item, open, onClose, onAdd }) {
  const [qty, setQty] = useState(STEPPER_START);

  useEffect(() => {
    if (open) setQty(STEPPER_START);
  }, [open, item]);

  const add = useCallback((n) => onAdd(clampQty(n)), [onAdd]);

  // Πληκτρολόγιο (laptop): 1-9 = άμεση προσθήκη, Enter = ο stepper, Esc = ακύρωση.
  // Capture + preventDefault ώστε τα πλήκτρα να ΜΗΝ φτάνουν στο πεδίο αναζήτησης
  // που κρατά ακόμα το focus (ο χρήστης συνεχίζει να γράφει κωδικούς μετά).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        add(Number(e.key));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        add(qty);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, qty, add, onClose]);

  if (!open || !item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="quantity-sheet-overlay"
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#2A0E14] border border-[#723645] shadow-2xl p-4"
        data-testid="quantity-sheet"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="font-heading text-xl font-bold text-white truncate">{item.name}</div>
            <div className="font-mono text-sm text-gold">{eur(item.price)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="quantity-sheet-close"
            title="Άκυρο"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-neutral-400 hover:text-white no-select"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {QUICK.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => add(n)}
              data-testid={`quantity-sheet-x${n}`}
              className="h-20 sm:h-24 rounded-lg bg-[#4A1B27] border border-[#723645] font-mono text-2xl sm:text-3xl font-bold text-white hover:border-flame active:scale-[0.96] no-select"
            >
              ×{n}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-[#431A25]">
          <Stepper value={qty} onChange={setQty} prefix="quantity-sheet" />
          <button
            type="button"
            onClick={() => add(qty)}
            data-testid="quantity-sheet-add"
            className="flex-1 h-14 rounded-lg bg-brand hover:bg-brand-hover text-white text-base font-bold active:scale-[0.98] no-select"
          >
            Προσθήκη ×{qty}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
