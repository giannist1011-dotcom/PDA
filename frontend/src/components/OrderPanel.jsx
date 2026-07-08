import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, Printer, ReceiptText, Truck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import LineEditModal from "@/components/LineEditModal";
import { ORDER_SOURCES } from "@/data/menu";
import { eur } from "@/lib/format";

const summarizeCustomization = (c) => {
  if (!c) return "";
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Extras: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Σως: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((sel) => {
      const names = sel.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${sel.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

const DELIVERY_FIELDS = [
  { key: "name", label: "Όνομα", placeholder: "π.χ. Νίκος" },
  { key: "phone", label: "Τηλέφωνο", placeholder: "6912345678", inputMode: "tel" },
  { key: "address", label: "Διεύθυνση", placeholder: "π.χ. Ερμού 12" },
  { key: "floor", label: "Όροφος", placeholder: "π.χ. 3ος" },
];

const TAKEAWAY_FIELDS = [
  { key: "name", label: "Όνομα", placeholder: "π.χ. Νίκος" },
  { key: "phone", label: "Τηλέφωνο", placeholder: "6912345678", inputMode: "tel" },
];

export default function OrderPanel({
  orderNumber,
  items,
  menuItemsById,
  source,
  onSourceChange,
  onIncrement,
  onDecrement,
  onSetQuantity,
  onRemove,
  onClear,
  onSubmit,
  submitting,
  delivery,
  setDelivery,
  onEditOptions,
}) {
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const isEmpty = items.length === 0;
  const isPhone = source === "Τηλέφωνο";
  const [editingLine, setEditingLine] = useState(null);

  // Reset delivery when source changes away from phone
  useEffect(() => {
    if (!isPhone && delivery) setDelivery(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const setField = (k, v) => setDelivery((d) => ({ ...(d || {}), [k]: v }));

  const canSubmit = !isEmpty && (!isPhone || !!delivery?.delivery_type);

  const activeFields = delivery?.delivery_type === "delivery"
    ? DELIVERY_FIELDS
    : delivery?.delivery_type === "takeaway"
      ? TAKEAWAY_FIELDS
      : [];

  return (
    <aside
      className="flex flex-col h-full bg-[#1A1A1A] border-l border-[#333] overflow-hidden"
      data-testid="order-panel"
    >
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

      <div className="flex-1 overflow-y-auto px-6" data-testid="order-items">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 py-16 text-center">
            <div className="text-lg font-heading">Άδεια παραγγελία</div>
            <div className="text-sm mt-1">Επιλέξτε προϊόντα από το μενού</div>
          </div>
        ) : (
          items.map((it) => {
            const menuItem = menuItemsById?.[it.item_id];
            const hasOpts = !!menuItem && (menuItem.customizable || (menuItem.option_groups || []).length > 0);
            return (
            <div
              key={it.line_id}
              className="py-4 border-b border-[#333] last:border-0"
              data-testid={`order-line-${it.line_id}`}
            >
              <button
                type="button"
                onClick={() => setEditingLine(it)}
                data-testid={`order-line-body-${it.line_id}`}
                className="w-full flex justify-between items-start gap-3 text-left rounded-md hover:bg-[#0F0F0F] active:scale-[0.995] transition-all p-1 -m-1"
              >
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
              </button>
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
            );
          })
        )}

        {/* Phone delivery section */}
        {isPhone && (
          <div className="mt-4 mb-2 p-3 rounded-md border border-[#FF6B00]/40 bg-[#FF6B00]/5" data-testid="delivery-section">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-2">
              Τύπος τηλεφωνικής παραγγελίας
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setDelivery({ delivery_type: "delivery", ...(delivery || {}) })}
                data-testid="delivery-btn-delivery"
                data-state={delivery?.delivery_type === "delivery" ? "on" : "off"}
                className={`h-12 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                  delivery?.delivery_type === "delivery"
                    ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                    : "bg-[#0D0D0D] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                }`}
              >
                <Truck className="w-4 h-4" /> Παράδοση
              </button>
              <button
                onClick={() => setDelivery({ delivery_type: "takeaway", ...(delivery || {}) })}
                data-testid="delivery-btn-takeaway"
                data-state={delivery?.delivery_type === "takeaway" ? "on" : "off"}
                className={`h-12 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                  delivery?.delivery_type === "takeaway"
                    ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                    : "bg-[#0D0D0D] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                }`}
              >
                <ShoppingBag className="w-4 h-4" /> Takeaway
              </button>
            </div>

            {activeFields.length > 0 && (
              <div className="space-y-2">
                {activeFields.map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      {f.label}
                    </label>
                    <input
                      value={delivery?.[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      inputMode={f.inputMode || "text"}
                      placeholder={f.placeholder}
                      data-testid={`delivery-input-${f.key}`}
                      className="w-full h-10 px-3 mt-0.5 bg-[#0D0D0D] border border-[#333] rounded-md text-sm text-white focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 pb-16 border-t border-[#333] bg-[#141414]">
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
            disabled={!canSubmit || submitting}
            data-testid="order-submit-btn"
            className="col-span-3 h-16 text-lg font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Printer className="w-5 h-5" />
            {submitting ? "Αποθήκευση..." : "Εκτύπωση & Αποθήκευση"}
          </Button>
        </div>
        {isPhone && !delivery?.delivery_type && (
          <div className="mt-2 text-xs text-[#FFB300] text-center">
            Επιλέξτε Παράδοση ή Takeaway για να συνεχίσετε
          </div>
        )}
      </div>

      <LineEditModal
        open={!!editingLine}
        line={editingLine}
        hasOptions={(() => {
          if (!editingLine) return false;
          const m = menuItemsById?.[editingLine.item_id];
          return !!m && (m.customizable || (m.option_groups || []).length > 0);
        })()}
        onClose={() => setEditingLine(null)}
        onQtyChange={(id, q) => onSetQuantity(id, q)}
        onRemove={(id) => onRemove(id)}
        onEditOptions={(line) => {
          setEditingLine(null);
          onEditOptions(line);
        }}
      />
    </aside>
  );
}
