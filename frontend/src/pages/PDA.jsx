import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, X, Printer, Ban, Phone as PhoneIcon, Percent } from "lucide-react";
import PinGateModal from "@/components/PinGateModal";
import AppShell from "@/components/AppShell";
import MenuGrid from "@/components/MenuGrid";
import OrderPanel from "@/components/OrderPanel";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
import { useAuth } from "@/context/AuthContext";
import { ORDER_SOURCES } from "@/data/menu";
import {
  apiGetMenuConfig,
  fetchNextOrderNumber,
  submitOrder,
  apiListScheduledOrders,
  apiActivateOrder,
  apiCancelOrder,
  formatApiError,
} from "@/lib/api";
import { eur } from "@/lib/format";

let LINE_SEQ = 1;
const newLineId = () => `L${Date.now()}-${LINE_SEQ++}`;

const FIRE_AHEAD_MS = 15 * 60 * 1000; // print 15' before the scheduled time
const POLL_MS = 60 * 1000;

const schedTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const schedDateTime = (iso) => {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
    return sameDay
      ? time
      : `${d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" })} ${time}`;
  } catch {
    return "";
  }
};

// Double-beep alert via WebAudio — no asset files needed
const playAlert = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (at, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.35);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    };
    beep(0, 880);
    beep(0.45, 880);
    beep(0.9, 1175);
  } catch {
    /* audio not available */
  }
};

// ---------- Discount modal ----------
const DISCOUNT_PERCENTS = [5, 10, 15, 20];

function DiscountModal({ open, subtotal, current, onApply, onRemove, onClose }) {
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
      <div className="bg-[#1A1A1A] border border-[#333] rounded-lg w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#00E676]" />
            <h3 className="font-heading text-lg font-bold">Έκπτωση</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="discount-modal-close"
            className="w-8 h-8 rounded-md border border-[#333] hover:border-[#FF6B00] flex items-center justify-center"
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
                    : "bg-[#0D0D0D] border-[#333] text-white hover:border-[#00E676]"
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
            className="flex-1 h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-[#00E676]"
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

// ---------- Scheduled orders modal ----------
function ScheduledOrdersModal({ open, orders, onClose, onPrintNow, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="scheduled-orders-modal"
    >
      <div className="bg-[#1A1A1A] border border-[#333] rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#00B0FF]" />
            <h3 className="font-heading text-xl font-bold">Προγραμματισμένες παραγγελίες</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="scheduled-modal-close"
            className="w-9 h-9 rounded-md border border-[#333] hover:border-[#FF6B00] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {orders.length === 0 ? (
            <div className="text-neutral-500 text-center py-10">
              Δεν υπάρχουν προγραμματισμένες παραγγελίες
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  data-testid={`scheduled-order-${o.id}`}
                  className="p-4 bg-[#0D0D0D] border border-[#00B0FF]/40 rounded-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-mono text-xl font-bold text-[#00B0FF] shrink-0">
                        {schedDateTime(o.scheduled_at)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-semibold text-sm truncate">
                          #{String(o.order_number).padStart(3, "0")}
                          {o.delivery?.name ? ` · ${o.delivery.name}` : ""}
                        </div>
                        {o.delivery?.phone && (
                          <div className="flex items-center gap-1 text-xs text-neutral-400">
                            <PhoneIcon className="w-3 h-3" /> {o.delivery.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white shrink-0">{eur(o.total)}</div>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 leading-snug">
                    {o.items.map((it) => `${it.quantity}x ${it.name}`).join(" · ")}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onPrintNow(o)}
                      data-testid={`scheduled-print-now-${o.id}`}
                      className="flex-1 h-10 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-white text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Τύπωσε τώρα
                    </button>
                    <button
                      onClick={() => onCancel(o)}
                      data-testid={`scheduled-cancel-${o.id}`}
                      className="h-10 px-4 rounded-md border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Ban className="w-4 h-4" /> Ακύρωση
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PDA() {
  const { user, isOwner } = useAuth();
  const [config, setConfig] = useState({ categories: [], items: [], customization: null });
  const [activeCategory, setActiveCategory] = useState(null);
  const [orderNumber, setOrderNumber] = useState(0);
  const [source, setSource] = useState(ORDER_SOURCES[0]);
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [editingLineId, setEditingLineId] = useState(null);
  const [initialCustomization, setInitialCustomization] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState(null);
  const [scheduled, setScheduled] = useState({ enabled: false, date: "", time: "" });
  const [scheduledOrders, setScheduledOrders] = useState([]);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const firingRef = useRef(false);
  const [discount, setDiscount] = useState(null); // {type: "percent"|"amount", value}
  const [discountOpen, setDiscountOpen] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);

  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const discountAmount = !discount
    ? 0
    : discount.type === "percent"
      ? Math.round(subtotal * discount.value) / 100
      : Math.min(discount.value, subtotal);

  const handleDiscountClick = () => {
    if (isOwner) setDiscountOpen(true);
    else setPinGateOpen(true); // employee: owner PIN required
  };

  const loadNext = async () => {
    try {
      setOrderNumber(await fetchNextOrderNumber());
    } catch {
      setOrderNumber(1);
    }
  };

  const loadConfig = async () => {
    try {
      const c = await apiGetMenuConfig();
      setConfig(c);
      if (c.categories?.length && !activeCategory) {
        setActiveCategory(c.categories[0].id);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- scheduled orders: load + poll every 60s, auto-fire 15' before ----
  const printReceipt = (order) =>
    new Promise((resolve) => {
      setPrintOrder({ ...order, restaurant_name: user?.restaurant_name });
      setTimeout(() => {
        window.print();
        resolve();
      }, 150);
    });

  const checkScheduled = async () => {
    if (firingRef.current) return;
    firingRef.current = true;
    try {
      const list = await apiListScheduledOrders();
      const now = Date.now();
      const due = list.filter(
        (o) => o.scheduled_at && new Date(o.scheduled_at).getTime() - now <= FIRE_AHEAD_MS
      );
      const pending = list.filter((o) => !due.some((d) => d.id === o.id));
      setScheduledOrders(pending);
      for (const o of due) {
        try {
          const activated = await apiActivateOrder(o.id);
          playAlert();
          toast.warning(
            `🕒 Ώρα για την προγραμματισμένη #${String(o.order_number).padStart(3, "0")}` +
              ` (${schedTime(o.scheduled_at)})${o.delivery?.name ? " — " + o.delivery.name : ""}`,
            { duration: 15000 }
          );
          await printReceipt(activated);
        } catch {
          // ήδη ενεργοποιημένη από άλλη συσκευή — απλώς προχωράμε
        }
      }
    } catch {
      // σφάλμα δικτύου — θα ξαναδοκιμάσει στο επόμενο poll
    } finally {
      firingRef.current = false;
    }
  };

  useEffect(() => {
    checkScheduled();
    const t = setInterval(checkScheduled, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrintNow = async (order) => {
    try {
      const activated = await apiActivateOrder(order.id);
      setScheduledOrders((p) => p.filter((o) => o.id !== order.id));
      await printReceipt(activated);
      toast.success(`Η #${String(order.order_number).padStart(3, "0")} τυπώθηκε`);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleCancelScheduled = async (order) => {
    if (!window.confirm(`Ακύρωση προγραμματισμένης #${String(order.order_number).padStart(3, "0")};`)) return;
    try {
      await apiCancelOrder(order.id);
      setScheduledOrders((p) => p.filter((o) => o.id !== order.id));
      toast.success("Ακυρώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const addLine = (item, customization = null, unitPriceOverride = null) => {
    const unit_price = unitPriceOverride ?? item.price;
    setItems((prev) => [
      ...prev,
      {
        line_id: newLineId(),
        item_id: item.id,
        name: item.name,
        category: item.category,
        unit_price,
        quantity: 1,
        line_total: unit_price,
        customization,
      },
    ]);
  };

  const handleItemClick = (item) => {
    if (item.available === false) return;
    const hasGroups = Array.isArray(item.option_groups) && item.option_groups.length > 0;
    if (hasGroups || item.customizable) {
      setModalItem(item);
      setModalMode("add");
      setEditingLineId(null);
      setInitialCustomization(null);
      setModalOpen(true);
    } else {
      addLine(item);
    }
  };

  const handleEditLineOptions = (line) => {
    const menuItem = config.items.find((i) => i.id === line.item_id);
    if (!menuItem) return;
    setModalItem(menuItem);
    setModalMode("edit");
    setEditingLineId(line.line_id);
    setInitialCustomization(line.customization || null);
    setModalOpen(true);
  };

  const handleConfirmCustomization = ({ customization, unit_price }) => {
    if (modalMode === "edit" && editingLineId) {
      setItems((prev) =>
        prev.map((it) =>
          it.line_id === editingLineId
            ? {
                ...it,
                customization,
                unit_price,
                line_total: unit_price * it.quantity,
              }
            : it
        )
      );
    } else {
      addLine(modalItem, customization, unit_price);
    }
    setModalOpen(false);
    setModalItem(null);
    setModalMode("add");
    setEditingLineId(null);
    setInitialCustomization(null);
  };

  const setLineQuantity = (lineId, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setItems((prev) =>
      prev.map((it) =>
        it.line_id === lineId ? { ...it, quantity: q, line_total: it.unit_price * q } : it
      )
    );
  };

  const updateQty = (lineId, delta) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.line_id !== lineId) return it;
        const nq = Math.max(1, it.quantity + delta);
        return { ...it, quantity: nq, line_total: it.unit_price * nq };
      })
    );
  };

  const removeLine = (lineId) => setItems((prev) => prev.filter((it) => it.line_id !== lineId));
  const clearOrder = () => {
    setItems([]);
    setDiscount(null);
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    const isScheduled = scheduled.enabled && scheduled.time;
    let scheduledAt = null;
    if (isScheduled) {
      const dt = new Date(`${scheduled.date || new Date().toISOString().slice(0, 10)}T${scheduled.time}:00`);
      if (Number.isNaN(dt.getTime())) {
        toast.error("Μη έγκυρη ώρα προγραμματισμού");
        return;
      }
      scheduledAt = dt.toISOString();
    }
    setSubmitting(true);
    const payload = {
      order_number: orderNumber,
      source,
      subtotal,
      total: Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
      discount:
        discount && discountAmount > 0
          ? { type: discount.type, value: discount.value, amount: discountAmount }
          : null,
      delivery: source === "Τηλέφωνο" && delivery?.delivery_type ? delivery : null,
      scheduled_at: scheduledAt,
      items: items.map((it) => ({
        item_id: it.item_id,
        name: it.name,
        category: it.category,
        unit_price: it.unit_price,
        quantity: it.quantity,
        line_total: it.line_total,
        customization: it.customization,
      })),
    };
    try {
      const saved = await submitOrder(payload);
      if (isScheduled) {
        toast.success(
          `Η #${String(saved.order_number).padStart(3, "0")} προγραμματίστηκε για ${schedDateTime(scheduledAt)}`
        );
        setScheduledOrders((p) =>
          [...p, saved].sort(
            (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
          )
        );
      } else {
        setPrintOrder({ ...saved, restaurant_name: user.restaurant_name });
        setTimeout(() => window.print(), 100);
        toast.success(`Παραγγελία #${saved.order_number} αποθηκεύτηκε`);
      }
      setItems([]);
      setDelivery(null);
      setDiscount(null);
      setScheduled({ enabled: false, date: "", time: "" });
      await loadNext();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Παραγγελίες">
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          Φόρτωση μενού...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Παραγγελίες">
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] overflow-y-auto lg:overflow-hidden">
        <section className="p-6 lg:overflow-hidden flex flex-col min-h-0">
          {scheduledOrders.length > 0 && (
            <button
              onClick={() => setScheduledOpen(true)}
              data-testid="scheduled-badge-btn"
              className="mb-4 shrink-0 flex items-center gap-2 self-start px-4 h-10 rounded-md border border-[#00B0FF]/50 bg-[#00B0FF]/10 text-[#00B0FF] text-sm font-bold hover:bg-[#00B0FF]/20 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Προγραμματισμένες: {scheduledOrders.length}
              <span className="text-xs font-normal text-[#00B0FF]/70">
                · επόμενη {schedDateTime(scheduledOrders[0]?.scheduled_at)}
              </span>
            </button>
          )}
          <MenuGrid
            categories={config.categories}
            items={config.items}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onItemClick={handleItemClick}
          />
        </section>
        <OrderPanel
          orderNumber={orderNumber}
          items={items}
          menuItemsById={Object.fromEntries((config.items || []).map((i) => [i.id, i]))}
          source={source}
          onSourceChange={setSource}
          delivery={delivery}
          setDelivery={setDelivery}
          scheduled={scheduled}
          setScheduled={setScheduled}
          discount={discount}
          discountAmount={discountAmount}
          onDiscountClick={handleDiscountClick}
          onIncrement={(id) => updateQty(id, 1)}
          onDecrement={(id) => updateQty(id, -1)}
          onSetQuantity={setLineQuantity}
          onRemove={removeLine}
          onClear={clearOrder}
          onSubmit={handleSubmit}
          onEditOptions={handleEditLineOptions}
          submitting={submitting}
        />
      </main>

      <CustomizationModal
        item={modalItem}
        config={config.customization}
        open={modalOpen}
        mode={modalMode}
        initialCustomization={initialCustomization}
        onClose={() => {
          setModalOpen(false);
          setModalItem(null);
          setModalMode("add");
          setEditingLineId(null);
          setInitialCustomization(null);
        }}
        onConfirm={handleConfirmCustomization}
      />
      <ScheduledOrdersModal
        open={scheduledOpen}
        orders={scheduledOrders}
        onClose={() => setScheduledOpen(false)}
        onPrintNow={handlePrintNow}
        onCancel={handleCancelScheduled}
      />
      <DiscountModal
        open={discountOpen}
        subtotal={subtotal}
        current={discount}
        onApply={(d) => {
          setDiscount(d);
          setDiscountOpen(false);
        }}
        onRemove={() => {
          setDiscount(null);
          setDiscountOpen(false);
        }}
        onClose={() => setDiscountOpen(false)}
      />
      <PinGateModal
        open={pinGateOpen}
        title="Απαιτείται PIN ιδιοκτήτη για έκπτωση"
        onClose={() => setPinGateOpen(false)}
        onSuccess={() => {
          setPinGateOpen(false);
          setDiscountOpen(true);
        }}
      />
      <Receipt order={printOrder} />
    </AppShell>
  );
}
