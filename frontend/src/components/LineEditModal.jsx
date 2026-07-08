import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { eur } from "@/lib/format";

const summarize = (c) => {
  if (!c) return "";
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Extras: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Σως: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((s) => {
      const names = s.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${s.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

export default function LineEditModal({
  open,
  line,
  hasOptions,
  onClose,
  onQtyChange,
  onRemove,
  onEditOptions,
}) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (line) setQty(line.quantity);
  }, [line, open]);

  if (!line) return null;

  const unitPrice = line.unit_price;
  const lineTotal = unitPrice * qty;
  const summary = summarize(line.customization);

  const commitAndClose = () => {
    if (qty !== line.quantity) onQtyChange(line.line_id, qty);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && commitAndClose()}>
      <DialogContent
        data-testid="line-edit-modal"
        className="max-w-md bg-[#0D0D0D] border-[#333] text-white"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl leading-tight">
            {line.name}
          </DialogTitle>
          {summary && (
            <p className="text-sm text-neutral-400 mt-1 leading-snug">{summary}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-[#1A1A1A] border border-[#333] rounded-lg">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
              Ποσότητα
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                data-testid="line-edit-decrement"
                className="w-16 h-16 rounded-lg bg-[#0D0D0D] border border-[#333] hover:border-[#FF6B00] text-white flex items-center justify-center active:scale-95 transition-transform"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div
                className="font-mono text-5xl font-bold w-24 text-center"
                data-testid="line-edit-qty"
              >
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                data-testid="line-edit-increment"
                className="w-16 h-16 rounded-lg bg-[#0D0D0D] border border-[#333] hover:border-[#FF6B00] text-white flex items-center justify-center active:scale-95 transition-transform"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex items-baseline justify-between px-1">
            <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
              Σύνολο γραμμής
            </span>
            <span
              className="font-mono text-2xl font-bold text-[#FF6B00]"
              data-testid="line-edit-total"
            >
              {eur(lineTotal)}
            </span>
          </div>

          {hasOptions && (
            <Button
              onClick={() => onEditOptions(line)}
              data-testid="line-edit-options-btn"
              className="w-full h-12 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white font-bold flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Επεξεργασία επιλογών
            </Button>
          )}

          <Button
            onClick={() => {
              onRemove(line.line_id);
              onClose();
            }}
            data-testid="line-edit-remove-btn"
            className="w-full h-12 bg-transparent border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 hover:border-[#FF3B30] font-bold flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Αφαίρεση από παραγγελία
          </Button>
        </div>

        <DialogFooter>
          <Button
            onClick={commitAndClose}
            data-testid="line-edit-done-btn"
            className="w-full h-14 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-base"
          >
            Ολοκλήρωση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
