import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { eur } from "@/lib/format";
import QtyStepper from "./QtyStepper";

// Η ποσότητα ορίζεται ΠΑΝΤΑ πριν μπει το προϊόν στο δελτίο:
// - χωρίς παραμετροποίηση → QuantitySheet (μικρό popup: όνομα, stepper, «Προσθήκη»)
// - με παραμετροποίηση → QuantityRow στην κορυφή του sheet επιλογών
// ΜΟΝΟ ο stepper — κανένα κουμπί ×1 ×2 ×3 ×4.
// Οι +/- steppers πάνω στις γραμμές του δελτίου μένουν ως δρόμος διόρθωσης.

const MAX_QTY = 99;

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Number(n) || 1));

// Γραμμή ποσότητας ΣΤΗΝ ΚΟΡΥΦΗ του sheet επιλογών (προϊόντα ΜΕ παραμετροποίηση):
// default 1, η προσθήκη γίνεται με το υπάρχον κουμπί επιβεβαίωσης.
export function QuantityRow({ value, onChange }) {
  return (
    <section data-testid="quantity-row">
      <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">Ποσότητα</h3>
      <QtyStepper
        size="lg"
        value={value}
        onDecrement={() => onChange(clampQty(value - 1))}
        onIncrement={() => onChange(clampQty(value + 1))}
        decrementTestId="quantity-row-minus"
        valueTestId="quantity-row-value"
        incrementTestId="quantity-row-plus"
      />
    </section>
  );
}

// Μικρό popup ποσότητας για προϊόντα ΧΩΡΙΣ παραμετροποίηση: όνομα προϊόντος,
// stepper (default 1) και από κάτω μεγάλο κουμπί «Προσθήκη».
// tap έξω / X / Escape = ακύρωση. Χωρίς animations — καμία καθυστέρηση.
export default function QuantitySheet({ item, open, onClose, onAdd }) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) setQty(1);
  }, [open, item]);

  const add = useCallback((n) => onAdd(clampQty(n)), [onAdd]);

  // Πληκτρολόγιο (laptop): 1-9 ορίζουν την ποσότητα στον stepper, Enter =
  // «Προσθήκη», Escape = ακύρωση. Capture + preventDefault ώστε τα πλήκτρα να
  // ΜΗΝ φτάνουν στο πεδίο αναζήτησης που κρατά ακόμα το focus.
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
        setQty(Number(e.key));
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
        className="w-full max-w-sm rounded-xl bg-[#3D1620] border border-[#723645] shadow-2xl p-4"
        data-testid="quantity-sheet"
      >
        <div className="flex items-start gap-3 mb-4">
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

        <div className="flex justify-center mb-4">
          <QtyStepper
            size="lg"
            value={qty}
            onDecrement={() => setQty((q) => clampQty(q - 1))}
            onIncrement={() => setQty((q) => clampQty(q + 1))}
            decrementTestId="quantity-sheet-minus"
            valueTestId="quantity-sheet-value"
            incrementTestId="quantity-sheet-plus"
          />
        </div>

        <button
          type="button"
          onClick={() => add(qty)}
          data-testid="quantity-sheet-add"
          className="w-full h-14 rounded-lg bg-brand hover:bg-brand-hover text-white text-base font-bold active:scale-[0.98] no-select"
        >
          Προσθήκη
        </button>
      </div>
    </div>,
    document.body
  );
}
