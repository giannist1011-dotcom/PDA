import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, Printer, ReceiptText, Truck, ShoppingBag, Clock, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import LineEditModal from "@/components/LineEditModal";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import TimePicker from "@/components/TimePicker";
import DatePicker from "@/components/DatePicker";
import { ORDER_SOURCES } from "@/data/menu";
import { eur, todayISO } from "@/lib/format";

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
  { key: "city", label: "Πόλη", placeholder: "π.χ. Χαλκίδα" },
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
  scheduled,
  setScheduled,
  discount,
  discountAmount = 0,
  onDiscountClick,
  onEditOptions,
  storeCity = "",
  storeLat = null,
  storeLng = null,
  deliveryRadiusKm = 6,
}) {
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const isEmpty = items.length === 0;
  const isPhone = source === "Τηλέφωνο";
  const [editingLine, setEditingLine] = useState(null);
  // Η διεύθυνση εντοπίστηκε αλλά εκτός ζώνης διανομής — προειδοποίηση, όχι εμπόδιο
  const [outOfZone, setOutOfZone] = useState(false);

  // Reset delivery & scheduling when source changes away from phone
  useEffect(() => {
    if (!isPhone) {
      if (delivery) setDelivery(null);
      if (scheduled?.enabled) setScheduled({ enabled: false, date: "", time: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const setField = (k, v) => setDelivery((d) => ({ ...(d || {}), [k]: v }));

  // Παράδοση/Takeaway: εναλλαγή μεταξύ τους, δεύτερο πάτημα στο ίδιο = αποεπιλογή.
  // Τα συμπληρωμένα στοιχεία (όνομα/τηλέφωνο/διεύθυνση) διατηρούνται στην εναλλαγή.
  const toggleDeliveryType = (type) =>
    setDelivery((d) => {
      const { delivery_type, ...fields } = d || {};
      if (delivery_type === type) {
        return Object.values(fields).some(Boolean) ? fields : null;
      }
      const next = { ...fields, delivery_type: type };
      // Προσυμπλήρωση πόλης από τα Στοιχεία καταστήματος (επεξεργάσιμη)
      if (type === "delivery" && !next.city && storeCity) next.city = storeCity;
      return next;
    });

  const canSubmit =
    !isEmpty &&
    (!isPhone || !!delivery?.delivery_type) &&
    (!scheduled?.enabled || !!scheduled?.time);

  const activeFields = delivery?.delivery_type === "delivery"
    ? DELIVERY_FIELDS
    : delivery?.delivery_type === "takeaway"
      ? TAKEAWAY_FIELDS
      : [];

  return (
    <aside
      className="flex flex-col h-full bg-[#3D1620] border-l border-[#723645] overflow-hidden"
      data-testid="order-panel"
    >
      {/* Zone 1 — fixed header: order number + source buttons */}
      <div className="p-4 lg:p-5 border-b border-[#723645] shrink-0">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Παραγγελία
            </div>
            <div
              className="font-mono text-2xl lg:text-3xl font-bold text-white mt-1"
              data-testid="order-number"
            >
              #{String(orderNumber || 0).padStart(3, "0")}
            </div>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <ReceiptText className="w-5 h-5" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 mt-3 lg:mt-4 bg-[#2A0E14] rounded-md" data-testid="source-toggle">
          {ORDER_SOURCES.map((s) => {
            const active = source === s;
            return (
              <button
                key={s}
                onClick={() => onSourceChange(s)}
                data-testid={`source-btn-${s}`}
                data-state={active ? "on" : "off"}
                className={`h-10 rounded-md text-xs lg:text-sm font-bold transition-all ${
                  active
                    ? "bg-brand text-white"
                    : "text-neutral-400 hover:text-white hover:bg-[#451924]"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone 2 — scrollable: order lines + στοιχεία παράδοσης (ό,τι μπορεί να μεγαλώσει) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5" data-testid="order-items">
        {isEmpty ? (
          <div className={`flex flex-col items-center justify-center text-neutral-500 py-16 text-center ${isPhone ? "" : "h-full"}`}>
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
              className="py-4 border-b border-[#723645] last:border-0"
              data-testid={`order-line-${it.line_id}`}
            >
              <button
                type="button"
                onClick={() => setEditingLine(it)}
                data-testid={`order-line-body-${it.line_id}`}
                className="w-full flex justify-between items-start gap-3 text-left rounded-md hover:bg-[#2C0F16] active:scale-[0.995] transition-all p-1 -m-1"
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
                <div className="flex items-center gap-2 bg-[#2A0E14] rounded-md p-1">
                  <button
                    onClick={() => onDecrement(it.line_id)}
                    data-testid={`decrement-${it.line_id}`}
                    className="w-10 h-10 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
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
                    className="w-10 h-10 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
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

        {/* Στοιχεία παράδοσης (Τηλέφωνο) — ΜΕΣΑ στη scrollable ζώνη ώστε να ΜΗΝ σπρώχνουν
            το footer (Σύνολο/Εκτύπωση) εκτός οθόνης σε tablet */}
        {isPhone && (
          <div className="mt-3 mb-1 p-2 rounded-md border border-flame/40 bg-flame/5" data-testid="delivery-section">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => toggleDeliveryType("delivery")}
                data-testid="delivery-btn-delivery"
                data-state={delivery?.delivery_type === "delivery" ? "on" : "off"}
                className={`h-10 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                  delivery?.delivery_type === "delivery"
                    ? "bg-brand border-brand text-white"
                    : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                }`}
              >
                <Truck className="w-4 h-4" /> Παράδοση
              </button>
              <button
                onClick={() => toggleDeliveryType("takeaway")}
                data-testid="delivery-btn-takeaway"
                data-state={delivery?.delivery_type === "takeaway" ? "on" : "off"}
                className={`h-10 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                  delivery?.delivery_type === "takeaway"
                    ? "bg-brand border-brand text-white"
                    : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                }`}
              >
                <ShoppingBag className="w-4 h-4" /> Takeaway
              </button>
            </div>

            {/* Scheduled order toggle */}
            <div className="mt-1.5">
              <button
                onClick={() =>
                  setScheduled((s) =>
                    s?.enabled
                      ? { enabled: false, date: "", time: "" }
                      : { enabled: true, date: todayISO(), time: "" }
                  )
                }
                data-testid="scheduled-toggle-btn"
                data-state={scheduled?.enabled ? "on" : "off"}
                className={`w-full h-10 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                  scheduled?.enabled
                    ? "bg-[#00B0FF] border-[#00B0FF] text-white"
                    : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-[#00B0FF]"
                }`}
              >
                <Clock className="w-4 h-4" /> Προγραμματισμένη
              </button>
              {scheduled?.enabled && (
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <TimePicker
                    value={scheduled.time}
                    onChange={(time) => setScheduled((s) => ({ ...s, time }))}
                    testId="scheduled-time-input"
                    className="w-full focus:border-[#00B0FF]"
                  />
                  <DatePicker
                    value={scheduled.date}
                    min={todayISO()}
                    onChange={(date) => setScheduled((s) => ({ ...s, date }))}
                    testId="scheduled-date-input"
                    className="w-full focus:border-[#00B0FF]"
                  />
                </div>
              )}
            </div>

            {activeFields.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {activeFields.map((f) =>
                  f.key === "address" ? (
                    // Διεύθυνση σε πλήρες πλάτος με autocomplete (γνωστοί πελάτες + Photon)
                    <div key={f.key} className="col-span-2">
                      <AddressAutocomplete
                        value={delivery?.address || ""}
                        onChange={(v) => setField("address", v)}
                        city={delivery?.city || storeCity}
                        storeLat={storeLat}
                        storeLng={storeLng}
                        radiusKm={deliveryRadiusKm}
                        onZoneStatus={setOutOfZone}
                        placeholder={f.label + " — " + f.placeholder}
                        testId="delivery-input-address"
                      />
                      {outOfZone && delivery?.delivery_type === "delivery" && (
                        <div
                          data-testid="delivery-out-of-zone"
                          className="mt-1 text-[11px] text-[#FFB300] flex items-center gap-1"
                        >
                          ⚠ Η διεύθυνση φαίνεται εκτός ζώνης διανομής ({deliveryRadiusKm} km)
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      key={f.key}
                      value={delivery?.[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      inputMode={f.inputMode || "text"}
                      placeholder={f.label + " — " + f.placeholder}
                      data-testid={`delivery-input-${f.key}`}
                      className="w-full h-9 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
                    />
                  )
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Zone 3 — fixed footer: total + actions (ΠΑΝΤΑ ορατό, δεν μεγαλώνει ποτέ) */}
      <div className="px-4 py-3 border-t border-[#723645] bg-[#33111A] shrink-0">
        {discountAmount > 0 && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-neutral-500 uppercase tracking-widest font-bold">
                Υποσύνολο
              </span>
              <span className="font-mono text-sm text-neutral-400" data-testid="order-subtotal">
                {eur(subtotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] text-[#00E676] uppercase tracking-widest font-bold">
                Έκπτωση{discount?.type === "percent" ? ` ${discount.value}%` : ""}
              </span>
              <span className="font-mono text-sm font-bold text-[#00E676]" data-testid="order-discount">
                -{eur(discountAmount)}
              </span>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between mb-2">
          <span className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-bold">
              Σύνολο
            </span>
            {onDiscountClick && (
            <button
              onClick={onDiscountClick}
              disabled={isEmpty}
              data-testid="discount-btn"
              className={`flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                discountAmount > 0
                  ? "border-[#00E676]/50 text-[#00E676] bg-[#00E676]/10 hover:bg-[#00E676]/20"
                  : "border-[#723645] text-neutral-300 hover:border-[#00E676] hover:text-[#00E676]"
              }`}
            >
              <Percent className="w-3 h-3" />
              Έκπτωση
            </button>
            )}
          </span>
          <span
            className="font-mono text-2xl font-bold text-white"
            data-testid="order-total"
          >
            {eur(total)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            onClick={onClear}
            disabled={isEmpty}
            data-testid="order-clear-btn"
            variant="ghost"
            className="col-span-1 h-12 text-xs font-bold text-neutral-100 bg-[#4A1B27] border border-[#7E3B50] hover:bg-[#582233] hover:text-white disabled:opacity-40"
          >
            Καθαρισμός
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            data-testid="order-submit-btn"
            className="col-span-3 h-12 text-base font-bold bg-brand hover:bg-brand-hover text-white flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {scheduled?.enabled ? <Clock className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
            {submitting
              ? "Αποθήκευση..."
              : scheduled?.enabled
                ? "Προγραμματισμός"
                : "Εκτύπωση & Αποθήκευση"}
          </Button>
        </div>
        {isPhone && !delivery?.delivery_type && (
          <div className="mt-1.5 text-[11px] text-gold text-center">
            Επιλέξτε Παράδοση ή Takeaway για να συνεχίσετε
          </div>
        )}
        {scheduled?.enabled && !scheduled?.time && (
          <div className="mt-1.5 text-[11px] text-[#00B0FF] text-center">
            Ορίστε ώρα για την προγραμματισμένη παραγγελία
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
