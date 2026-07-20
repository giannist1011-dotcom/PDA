import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Percent } from "lucide-react";

const DISCOUNT_PERCENTS = [5, 10, 15, 20];

export default function DiscountModal({ open, subtotal, current, onApply, onRemove, onClose }) {
  const [amountText, setAmountText] = useState("");

  useEffect(() => {
    if (open) setAmountText(current?.type === "amount" ? String(current.value) : "");
  }, [open, current]);

  if (!open) return null;

  const applyAmount = () => {
    const v = parseFloat(String(amountText).replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Εισάγετε έγκυρο ποσό έκπτωσης");
      return;
    }
    if (v > subtotal) {
      toast.error("Η έκπτωση δεν μπορεί να υπερβαίνει το σύνολο");
      return;
    }
    onApply({ type: "amount", value: Math.round(v * 100) / 100 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="discount-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#00E676]" />
            <h3 className="font-heading text-lg font-bold">Έκπτωση</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="discount-modal-close"
            className="w-8 h-8 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-2">
          Ποσοστό
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {DISCOUNT_PERCENTS.map((p) => {
            const active = current?.type === "percent" && current.value === p;
            return (
              <button
                key={p}
                onClick={() => onApply({ type: "percent", value: p })}
                data-testid={`discount-percent-${p}`}
                className={`h-12 rounded-md border font-mono font-bold text-lg transition-colors ${
                  active
                    ? "bg-[#00E676] border-[#00E676] text-black"
                    : "bg-[#2A0E14] border-[#723645] text-white hover:border-[#00E676]"
                }`}
              >
                {p}%
              </button>
            );
          })}
        </div>

        <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-2">
          Ή ποσό (€)
        </div>
        <div className="flex gap-2 mb-4">
          <input
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="π.χ. 2,00"
            data-testid="discount-amount-input"
            className="flex-1 h-12 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white font-mono focus:outline-none focus:border-[#00E676]"
          />
          <button
            onClick={applyAmount}
            data-testid="discount-amount-apply"
            className="h-12 px-4 rounded-md bg-[#00E676] hover:bg-[#33EB91] text-black font-bold"
          >
            OK
          </button>
        </div>

        {current && (
          <button
            onClick={onRemove}
            data-testid="discount-remove-btn"
            className="w-full h-11 rounded-md border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 text-sm font-bold"
          >
            Αφαίρεση έκπτωσης
          </button>
        )}
      </div>
    </div>
  );
}
