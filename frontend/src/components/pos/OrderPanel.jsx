import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, Printer, ReceiptText, Truck, ShoppingBag, Clock, Percent, StickyNote, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import LineEditModal from "@/components/pos/LineEditModal";
import AddressAutocomplete from "@/components/shared/AddressAutocomplete";
import TimePicker from "@/components/shared/TimePicker";
import DatePicker from "@/components/shared/DatePicker";
import { POS_ORDER_SOURCES } from "@/data/menu";
import { eur, todayISO } from "@/lib/format";
import { customizationLines } from "@/lib/customizationText";

// Πεδία δίπλα-δίπλα (2 στήλες): η διεύθυνση πιάνει πλήρες πλάτος, μετά
// όροφος+τηλέφωνο, μετά όνομα (+ σημείωση στο διπλανό κελί). Η πόλη είναι
// βοηθητική για το autocomplete — προσυμπληρώνεται από τα Στοιχεία καταστήματος
// και ανοίγει μόνο on demand, δεν καταλαμβάνει μόνιμο χώρο.
const DELIVERY_PAIRS = [
  { key: "floor", label: "Όροφος", placeholder: "π.χ. 3ος, ισόγειο" },
  { key: "phone", label: "Τηλέφωνο", placeholder: "6912345678", inputMode: "tel" },
  { key: "name", label: "Όνομα", placeholder: "π.χ. Νίκος" },
];

const TAKEAWAY_PAIRS = [
  { key: "name", label: "Όνομα", placeholder: "π.χ. Νίκος" },
  { key: "phone", label: "Τηλέφωνο", placeholder: "6912345678", inputMode: "tel" },
];

const FIELD_SKIN =
  "w-full h-9 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-flame";
const FIELD_CLS = `${FIELD_SKIN} px-3`;
// Compact chip της γραμμής τύπου (μετά την επιλογή) — το ενεργό highlighted
const CHIP_BASE =
  "h-8 px-2.5 rounded-full border text-[12px] font-bold flex items-center justify-center gap-1 shrink-0 transition-colors";
const CHIP_OFF = "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame";

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
  note = "",
  setNote,
  deliveryFee = 0,
  minOrder = 0,
  onEditOptions,
  storeCity = "",
  storeLat = null,
  storeLng = null,
  deliveryRadiusKm = 6,
  // Επεξεργασία υπάρχουσας παραγγελίας: κλειδωμένη πηγή, χωρίς προγραμματισμό
  editMode = false,
  onCancelEdit = null,
}) {
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const total = Math.max(0, subtotal - discountAmount + deliveryFee);
  // Κάτω από την ελάχιστη παραγγελία (μόνο σε παράδοση) — προειδοποίηση, όχι εμπόδιο
  const belowMinimum =
    minOrder > 0 && delivery?.delivery_type === "delivery" && subtotal > 0 && subtotal < minOrder;
  const isEmpty = items.length === 0;
  const isPhone = source === "Τηλέφωνο";
  // Σε επεξεργασία παλιάς παραγγελίας από πλατφόρμα (efood/Box/Wolt) κρατάμε
  // την πηγή της ορατή (τα κουμπιά είναι ούτως ή άλλως κλειδωμένα σε edit).
  const sources = POS_ORDER_SOURCES.includes(source)
    ? POS_ORDER_SOURCES
    : [...POS_ORDER_SOURCES, source];
  const [editingLine, setEditingLine] = useState(null);
  // Η διεύθυνση εντοπίστηκε αλλά εκτός ζώνης διανομής — προειδοποίηση, όχι εμπόδιο
  const [outOfZone, setOutOfZone] = useState(false);
  // Πόλη: κρυφή όσο ισχύει η προσυμπληρωμένη — ανοίγει μόνο όταν χρειάζεται αλλαγή
  const [cityOpen, setCityOpen] = useState(false);

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

  const isDelivery = delivery?.delivery_type === "delivery";
  const typeChosen = !!delivery?.delivery_type;
  const activeFields = isDelivery
    ? DELIVERY_PAIRS
    : delivery?.delivery_type === "takeaway"
      ? TAKEAWAY_PAIRS
      : [];
  // Με επιλεγμένο τύπο η σημείωση μπαίνει ΜΕΣΑ στο πλέγμα (δίπλα στο όνομα σε
  // παράδοση, πλήρες πλάτος σε takeaway) — δεν παίρνει δική της σειρά
  const noteInGrid = isPhone && typeChosen && !!setNote;

  const renderNote = (cls) => (
    <div className={`relative ${cls}`}>
      <StickyNote className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Σημείωση"
        data-testid="order-note-input"
        className={`${FIELD_SKIN} pl-9 pr-3`}
      />
    </div>
  );

  return (
    <aside
      className="flex flex-col h-full bg-[#3D1620] border-l border-[#723645] overflow-hidden"
      data-testid="order-panel"
    >
      {/* Zone 1 — fixed header: order number + source buttons */}
      <div className="p-4 lg:p-5 border-b border-[#723645] shrink-0">
        <div className="flex items-baseline justify-between">
          <div>
            <div
              className={`text-xs font-bold uppercase tracking-widest ${
                editMode ? "text-gold" : "text-neutral-400"
              }`}
            >
              {editMode ? "Επεξεργασία παραγγελίας" : "Παραγγελία"}
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

        {/* Πηγή παραγγελίας ταμείου: μόνο «Ταμείο»/«Τηλέφωνο». Οι πλατφόρμες
            έχουν δικές τους καρτέλες στην κορυφή της σελίδας — δεν καταχωρούνται
            με το χέρι από εδώ. */}
        <div
          className={`grid gap-1 p-1 mt-3 lg:mt-4 bg-[#2A0E14] rounded-md ${
            sources.length > 2 ? "grid-cols-3" : "grid-cols-2"
          }`}
          data-testid="source-toggle"
        >
          {sources.map((s) => {
            const active = source === s;
            return (
              <button
                key={s}
                onClick={() => onSourceChange(s)}
                disabled={editMode}
                data-testid={`source-btn-${s}`}
                data-state={active ? "on" : "off"}
                className={`h-10 rounded-md text-xs lg:text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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

      {/* ΜΕΣΑΙΑ ΠΕΡΙΟΧΗ (ζώνη 2 + ζώνη 3α): μοιράζεται ό,τι απομένει ανάμεσα στο
          header και το σταθερό footer. Τα ΠΡΟΪΟΝΤΑ κρατούν ΠΑΝΤΑ ≥35% αυτού του
          ύψους (min-h-[35%]) με δικό τους scroll — δεν μηδενίζονται ποτέ όταν
          ανοίγουν τα πεδία παράδοσης· η κάτω ζώνη κόβεται στο 60% με εσωτερικό
          scroll στα πεδία της. */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Zone 2 — scrollable: ΜΟΝΟ οι γραμμές της παραγγελίας. */}
      <div
        className="flex-1 min-h-[35%] overflow-y-auto px-4 lg:px-5"
        data-testid="order-items"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center text-neutral-500 py-16 text-center h-full">
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
                  {/* Ίδια σειρά με την απόδειξη: ψωμί, διπλό, υλικά, λοιπά, σως */}
                  {customizationLines(it.customization).map((line, li) => (
                    <div key={li} className="text-xs text-neutral-400 mt-1 leading-snug">
                      {line}
                    </div>
                  ))}
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
      </div>

      {/* Zone 3α — κάτω ζώνη, ακριβώς πάνω από τη μπάρα συνόλου: γραμμή τύπου
          (Παράδοση/Takeaway/Προγραμματισμένη) → πεδία σε 2 στήλες → σημείωση.
          ΠΟΤΕ πάνω από το 60% της μεσαίας περιοχής: ό,τι δεν χωράει κυλάει με
          ΕΣΩΤΕΡΙΚΟ scroll — τα προϊόντα από πάνω μένουν πάντα ορατά. */}
      {(isPhone || setNote) && (
      <div
        className="shrink-0 max-h-[60%] overflow-y-auto px-4 lg:px-5 pt-1.5"
        data-testid="order-controls"
      >
        {isPhone && (
          <div className="mb-1 p-2 rounded-md border border-flame/40 bg-flame/5" data-testid="delivery-section">
            {/* Πριν την επιλογή: μεγάλα κουμπιά (η βασική ενέργεια). Μετά: μία
                compact γραμμή chips — tap για αλλαγή, το ενεργό highlighted. */}
            {typeChosen ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" data-testid="delivery-type-chips">
                <button
                  onClick={() => toggleDeliveryType("delivery")}
                  data-testid="delivery-btn-delivery"
                  data-state={isDelivery ? "on" : "off"}
                  className={`${CHIP_BASE} ${
                    isDelivery ? "bg-brand border-brand text-white" : CHIP_OFF
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" /> Παράδοση
                </button>
                <button
                  onClick={() => toggleDeliveryType("takeaway")}
                  data-testid="delivery-btn-takeaway"
                  data-state={delivery?.delivery_type === "takeaway" ? "on" : "off"}
                  className={`${CHIP_BASE} ${
                    delivery?.delivery_type === "takeaway"
                      ? "bg-brand border-brand text-white"
                      : CHIP_OFF
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Takeaway
                </button>
                {!editMode && (
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
                    className={`${CHIP_BASE} ${
                      scheduled?.enabled
                        ? "bg-[#00B0FF] border-[#00B0FF] text-white"
                        : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-[#00B0FF]"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Προγραμματισμένη
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => toggleDeliveryType("delivery")}
                    data-testid="delivery-btn-delivery"
                    data-state="off"
                    className="h-10 rounded-md text-sm font-bold flex items-center justify-center gap-2 border bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                  >
                    <Truck className="w-4 h-4" /> Παράδοση
                  </button>
                  <button
                    onClick={() => toggleDeliveryType("takeaway")}
                    data-testid="delivery-btn-takeaway"
                    data-state="off"
                    className="h-10 rounded-md text-sm font-bold flex items-center justify-center gap-2 border bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                  >
                    <ShoppingBag className="w-4 h-4" /> Takeaway
                  </button>
                </div>
                {!editMode && (
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
                    className={`w-full h-10 mt-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 border ${
                      scheduled?.enabled
                        ? "bg-[#00B0FF] border-[#00B0FF] text-white"
                        : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-[#00B0FF]"
                    }`}
                  >
                    <Clock className="w-4 h-4" /> Προγραμματισμένη
                  </button>
                )}
              </>
            )}

            {/* Ώρα/ημερομηνία μόνο όταν είναι όντως προγραμματισμένη */}
            {scheduled?.enabled && !editMode && (
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

            {typeChosen && (
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {isDelivery && (
                  // Διεύθυνση σε πλήρες πλάτος με autocomplete (γνωστοί πελάτες + Photon)
                  <div className="col-span-2">
                    <AddressAutocomplete
                      value={delivery?.address || ""}
                      onChange={(v) => setField("address", v)}
                      city={delivery?.city || storeCity}
                      storeLat={storeLat}
                      storeLng={storeLng}
                      radiusKm={deliveryRadiusKm}
                      onZoneStatus={setOutOfZone}
                      placeholder="Διεύθυνση — π.χ. Ερμού 12"
                      testId="delivery-input-address"
                    />
                    {outOfZone && (
                      <div
                        data-testid="delivery-out-of-zone"
                        className="mt-1 text-[11px] text-[#FFB300] flex items-center gap-1"
                      >
                        ⚠ Η διεύθυνση φαίνεται εκτός ζώνης διανομής ({deliveryRadiusKm} km)
                      </div>
                    )}
                  </div>
                )}
                {activeFields.map((f) => (
                  <input
                    key={f.key}
                    value={delivery?.[f.key] || ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    inputMode={f.inputMode || "text"}
                    placeholder={f.label}
                    data-testid={`delivery-input-${f.key}`}
                    className={FIELD_CLS}
                  />
                ))}
                {noteInGrid && renderNote(isDelivery ? "" : "col-span-2")}
                {/* Πόλη (autocomplete): προσυμπληρωμένη — ανοίγει μόνο on demand */}
                {isDelivery && (
                  <div className="col-span-2">
                    {cityOpen ? (
                      <input
                        value={delivery?.city || ""}
                        onChange={(e) => setField("city", e.target.value)}
                        placeholder="Πόλη — π.χ. Χαλκίδα"
                        data-testid="delivery-input-city"
                        className={FIELD_CLS}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCityOpen(true)}
                        data-testid="delivery-city-toggle"
                        className="text-[11px] text-neutral-400 hover:text-flame underline underline-offset-2"
                      >
                        Πόλη: {delivery?.city || storeCity || "—"} · αλλαγή
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Σημείωση παραγγελίας (όταν δεν έχει μπει στο πλέγμα των πεδίων) */}
        {setNote && !noteInGrid && <div className="mb-2">{renderNote("")}</div>}
      </div>
      )}
      </div>

      {/* Zone 3β — σταθερό footer στη ΒΑΣΗ: ΣΥΝΟΛΟ / Έκπτωση / Καθαρισμός /
          Εκτύπωση. Πάντα ορατό — δεν ανεβαίνει και δεν μεγαλώνει ποτέ. */}
      <div className="px-4 py-3 border-t border-[#723645] bg-[#33111A] shrink-0">
        {(discountAmount > 0 || deliveryFee > 0) && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-neutral-500 uppercase tracking-widest font-bold">
              Υποσύνολο
            </span>
            <span className="font-mono text-sm text-neutral-400" data-testid="order-subtotal">
              {eur(subtotal)}
            </span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-[#00E676] uppercase tracking-widest font-bold">
              Έκπτωση{discount?.type === "percent" ? ` ${discount.value}%` : ""}
            </span>
            <span className="font-mono text-sm font-bold text-[#00E676]" data-testid="order-discount">
              -{eur(discountAmount)}
            </span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-bold">
              Χρέωση delivery
            </span>
            <span className="font-mono text-sm text-neutral-300" data-testid="order-delivery-fee">
              +{eur(deliveryFee)}
            </span>
          </div>
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
            onClick={editMode ? onCancelEdit : onClear}
            disabled={!editMode && isEmpty}
            data-testid="order-clear-btn"
            variant="ghost"
            className="col-span-1 h-12 text-xs font-bold text-neutral-100 bg-[#4A1B27] border border-[#7E3B50] hover:bg-[#582233] hover:text-white disabled:opacity-40"
          >
            {editMode ? "Άκυρο" : "Καθαρισμός"}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            data-testid="order-submit-btn"
            className="col-span-3 h-12 text-base font-bold bg-brand hover:bg-brand-hover text-white flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {editMode ? (
              <Pencil className="w-4 h-4" />
            ) : scheduled?.enabled ? (
              <Clock className="w-4 h-4" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {submitting
              ? "Αποθήκευση..."
              : editMode
                ? "Αποθήκευση αλλαγών"
                : scheduled?.enabled
                  ? "Προγραμματισμός & Εκτύπωση"
                  : "Εκτύπωση & Αποθήκευση"}
          </Button>
        </div>
        {belowMinimum && (
          <div className="mt-1.5 text-[11px] text-[#FFB300] text-center" data-testid="order-below-minimum">
            ⚠ Κάτω από την ελάχιστη παραγγελία ({eur(minOrder)})
          </div>
        )}
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
