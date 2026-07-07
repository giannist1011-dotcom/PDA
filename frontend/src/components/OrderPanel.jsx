import { Minus, Plus, Trash2, Printer, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ORDER_SOURCES } from "@/data/menu";
import { eur } from "@/lib/format";

const summarizeCustomization = (c) => {
  if (!c) return "";
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Extras: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Σως: ${c.sauces.join(", ")}`);
  return parts.join(" · ");
};

export default function OrderPanel({
  orderNumber,
  items,
  source,
  onSourceChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onSubmit,
  submitting,
}) {
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const isEmpty = items.length === 0;

  return (
    <aside
      className="flex flex-col h-full bg-[#1A1A1A] border-l border-[#333] overflow-hidden"
      data-testid="order-panel"
    >
      {/* Header */}
      <div className="p-6 border-b border-[#333]">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Παραγγελία
            </div>
            <div
              className="font-mono text-3xl font-bold text-white mt-1"
              data-testid="order-number"
            >
              #{String(orderNumber || 0).padStart(3, "0")}
            </div>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <ReceiptText className="w-5 h-5" />
          </div>
        </div>

        {/* Source toggle */}
        <div className="grid grid-cols-4 gap-1 p-1 mt-5 bg-[#0D0D0D] rounded-md" data-testid="source-toggle">
          {ORDER_SOURCES.map((s) => {
            const active = source === s;
            return (
              <button
                key={s}
                onClick={() => onSourceChange(s)}
                data-testid={`source-btn-${s}`}
                data-state={active ? "on" : "off"}
                className={`h-11 rounded-md text-xs md:text-sm font-bold transition-all ${
                  active
                    ? "bg-[#FF6B00] text-white"
                    : "text-neutral-400 hover:text-white hover:bg-[#1F1F1F]"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-6" data-testid="order-items">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 py-16 text-center">
            <div className="text-lg font-heading">Άδεια παραγγελία</div>
            <div className="text-sm mt-1">Επιλέξτε προϊόντα από το μενού</div>
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.line_id}
              className="py-4 border-b border-[#333] last:border-0"
              data-testid={`order-line-${it.line_id}`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-white text-base leading-tight">
                    {it.name}
                  </div>
                  {it.customization && (
                    <div className="text-xs text-neutral-400 mt-1 leading-snug">
                      {summarizeCustomization(it.customization)}
                    </div>
                  )}
                </div>
                <div className="font-mono font-bold text-white">
                  {eur(it.line_total)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 bg-[#0D0D0D] rounded-md p-1">
                  <button
                    onClick={() => onDecrement(it.line_id)}
                    data-testid={`decrement-${it.line_id}`}
                    className="w-10 h-10 rounded flex items-center justify-center text-white hover:bg-[#262626] active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span
                    className="w-8 text-center font-mono font-bold text-lg"
                    data-testid={`qty-${it.line_id}`}
                  >
                    {it.quantity}
                  </span>
                  <button
                    onClick={() => onIncrement(it.line_id)}
                    data-testid={`increment-${it.line_id}`}
                    className="w-10 h-10 rounded flex items-center justify-center text-white hover:bg-[#262626] active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => onRemove(it.line_id)}
                  data-testid={`remove-${it.line_id}`}
                  className="text-neutral-400 hover:text-[#FF3B30] p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-6 pb-10 border-t border-[#333] bg-[#141414]">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-sm text-neutral-400 uppercase tracking-widest font-bold">
            Σύνολο
          </span>
          <span
            className="font-mono text-3xl font-bold text-white"
            data-testid="order-total"
          >
            {eur(subtotal)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Button
            onClick={onClear}
            disabled={isEmpty}
            data-testid="order-clear-btn"
            variant="ghost"
            className="col-span-1 h-16 text-sm font-bold text-neutral-300 border border-[#333] hover:bg-[#262626] hover:text-white disabled:opacity-40"
          >
            Καθαρισμός
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isEmpty || submitting}
            data-testid="order-submit-btn"
            className="col-span-3 h-16 text-lg font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Printer className="w-5 h-5" />
            {submitting ? "Αποθήκευση..." : "Εκτύπωση & Αποθήκευση"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
