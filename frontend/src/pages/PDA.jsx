import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import OrderPanel from "@/components/OrderPanel";
import { useAuth } from "@/context/AuthContext";
import { ORDER_SOURCES } from "@/data/menu";
import {
  fetchNextOrderNumber,
  submitOrder,
  apiListScheduledOrders,
  apiActivateOrder,
  apiCancelOrder,
  formatApiError,
} from "@/lib/api";
import {
  getMenuConfigCached,
  enqueueOrder,
  isNetworkError,
  markServerDown,
  getCachedNextOrderNumber,
  rememberNextOrderNumber,
} from "@/lib/offline";
import { formatGRTime } from "@/lib/format";
import { printReceiptJob } from "@/lib/print";
import MobileTabs from "./pda/MobileTabs";
import MenuSection from "./pda/MenuSection";
import PDAModals from "./pda/PDAModals";
import { schedDateTime } from "./pda/utils";

// Ενώνει οδό + πόλη σε πλήρη διεύθυνση (η πόλη δεν αποθηκεύεται ξεχωριστά)
const buildDeliveryPayload = (source, delivery) => {
  if (source !== "Τηλέφωνο" || !delivery?.delivery_type) return null;
  const { city, ...rest } = delivery;
  const street = (rest.address || "").trim();
  const cityTrim = (city || "").trim();
  if (street && cityTrim && !street.toLowerCase().includes(cityTrim.toLowerCase())) {
    rest.address = `${street}, ${cityTrim}`;
  }
  return rest;
};

let LINE_SEQ = 1;
const newLineId = () => `L${Date.now()}-${LINE_SEQ++}`;

const FIRE_AHEAD_MS = 15 * 60 * 1000; // print 15' before the scheduled time
const POLL_MS = 60 * 1000;

const schedTime = (iso) => formatGRTime(iso);

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

export default function PDA() {
  const { user, canManage } = useAuth();
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
  // Tablet-portrait / mobile: switch between menu and order panel (two-column on lg+)
  const [mobileTab, setMobileTab] = useState("menu");

  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const orderCount = items.reduce((s, it) => s + it.quantity, 0);
  // Σταθερό αντικείμενο ανά config — όχι νέο Object.fromEntries σε κάθε render/πλήκτρο
  const menuItemsById = useMemo(
    () => Object.fromEntries((config.items || []).map((i) => [i.id, i])),
    [config.items]
  );
  const discountAmount = !discount
    ? 0
    : discount.type === "percent"
      ? Math.round(subtotal * discount.value) / 100
      : Math.min(discount.value, subtotal);

  const handleDiscountClick = () => {
    if (canManage) setDiscountOpen(true);
    else setPinGateOpen(true); // employee: owner PIN required
  };

  const loadNext = async () => {
    try {
      const n = await fetchNextOrderNumber();
      setOrderNumber(n);
      rememberNextOrderNumber(n); // ώστε offline να συνεχίσει η αρίθμηση από εκεί
    } catch (e) {
      if (isNetworkError(e)) markServerDown();
      setOrderNumber(await getCachedNextOrderNumber());
    }
  };

  const loadConfig = async () => {
    try {
      const c = await getMenuConfigCached();
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
        printReceiptJob(user);
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
    } catch (e) {
      // σφάλμα δικτύου — θα ξαναδοκιμάσει στο επόμενο poll
      if (isNetworkError(e)) markServerDown();
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

  // useCallback: σταθερή αναφορά ώστε το memo(MenuSection) να μην ξαναρεντάρει το
  // πλέγμα μενού όταν αλλάζει άσχετο state (π.χ. πληκτρολόγηση στη φόρμα παράδοσης)
  const addLine = useCallback((item, customization = null, unitPriceOverride = null) => {
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
  }, []);

  const handleItemClick = useCallback((item) => {
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
  }, [addLine]);

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
      // Τοπική ημερομηνία (όχι toISOString = UTC — μετά τα μεσάνυχτα θα έδινε τη χθεσινή)
      const dt = new Date(`${scheduled.date || new Date().toLocaleDateString("sv")}T${scheduled.time}:00`);
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
      delivery: buildDeliveryPayload(source, delivery),
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
        setTimeout(() => printReceiptJob(user), 100);
        toast.success(`Παραγγελία #${saved.order_number} αποθηκεύτηκε`);
      }
      setItems([]);
      setDelivery(null);
      setDiscount(null);
      setScheduled({ enabled: false, date: "", time: "" });
      await loadNext();
    } catch (e) {
      // Offline path: χωρίς σύνδεση, η παραγγελία γράφεται σε τοπική ουρά,
      // τυπώνεται κανονικά και θα συγχρονιστεί αυτόματα (online = default, μόνο fallback)
      if (isNetworkError(e) && !isScheduled) {
        markServerDown();
        try {
          const entry = await enqueueOrder(payload);
          setPrintOrder({
            ...entry,
            id: entry.client_id,
            created_at: entry.client_created_at,
            restaurant_name: user.restaurant_name,
          });
          setTimeout(() => printReceiptJob(user), 100);
          toast.warning(
            `Εκτός σύνδεσης — η #${String(payload.order_number).padStart(3, "0")} αποθηκεύτηκε τοπικά και θα συγχρονιστεί`
          );
          setItems([]);
          setDelivery(null);
          setDiscount(null);
          setScheduled({ enabled: false, date: "", time: "" });
          setOrderNumber(payload.order_number + 1);
        } catch {
          toast.error("Αποτυχία τοπικής αποθήκευσης — δοκιμάστε ξανά");
        }
      } else if (isNetworkError(e) && isScheduled) {
        toast.error("Οι προγραμματισμένες παραγγελίες απαιτούν σύνδεση");
      } else {
        toast.error(formatApiError(e));
      }
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
      {/* Δίστηλο από sm (640px) και πάνω — tablet portrait/landscape & desktop.
          Το breakpoint βασίζεται σε CSS viewport width (Tailwind media queries),
          όχι σε user-agent/touch. Android tablets 1280x800 με DPR ~1.33 δίνουν
          ~960 CSS px, γι' αυτό το παλιό lg: (1024px) τα έριχνε σε mobile layout. */}
      <main className="flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_300px] md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] overflow-hidden">
        <MobileTabs mobileTab={mobileTab} setMobileTab={setMobileTab} orderCount={orderCount} />
        <MenuSection
          mobileTab={mobileTab}
          scheduledOrders={scheduledOrders}
          setScheduledOpen={setScheduledOpen}
          config={config}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          handleItemClick={handleItemClick}
        />
        <div
          className={`min-h-0 overflow-hidden flex-1 sm:flex-none flex-col ${
            mobileTab === "order" ? "flex" : "hidden"
          } sm:flex`}
        >
        <OrderPanel
          orderNumber={orderNumber}
          items={items}
          menuItemsById={menuItemsById}
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
          storeCity={user?.store_city || ""}
          storeLat={user?.store_lat ?? null}
          storeLng={user?.store_lng ?? null}
          deliveryRadiusKm={user?.delivery_radius_km || 6}
        />
        </div>
      </main>

      <PDAModals
        modalItem={modalItem}
        config={config}
        modalOpen={modalOpen}
        modalMode={modalMode}
        initialCustomization={initialCustomization}
        setModalOpen={setModalOpen}
        setModalItem={setModalItem}
        setModalMode={setModalMode}
        setEditingLineId={setEditingLineId}
        setInitialCustomization={setInitialCustomization}
        handleConfirmCustomization={handleConfirmCustomization}
        scheduledOpen={scheduledOpen}
        scheduledOrders={scheduledOrders}
        setScheduledOpen={setScheduledOpen}
        handlePrintNow={handlePrintNow}
        handleCancelScheduled={handleCancelScheduled}
        discountOpen={discountOpen}
        subtotal={subtotal}
        discount={discount}
        setDiscount={setDiscount}
        setDiscountOpen={setDiscountOpen}
        pinGateOpen={pinGateOpen}
        setPinGateOpen={setPinGateOpen}
        printOrder={printOrder}
      />
    </AppShell>
  );
}
