import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  formatApiError,
} from "@/lib/api";

let LINE_SEQ = 1;
const newLineId = () => `L${Date.now()}-${LINE_SEQ++}`;

export default function PDA() {
  const { user } = useAuth();
  const [config, setConfig] = useState({ categories: [], items: [], customization: null });
  const [activeCategory, setActiveCategory] = useState(null);
  const [orderNumber, setOrderNumber] = useState(0);
  const [source, setSource] = useState(ORDER_SOURCES[0]);
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState(null);

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
      setModalOpen(true);
    } else {
      addLine(item);
    }
  };

  const handleConfirmCustomization = ({ customization, unit_price }) => {
    addLine(modalItem, customization, unit_price);
    setModalOpen(false);
    setModalItem(null);
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
  const clearOrder = () => setItems([]);

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    const subtotal = items.reduce((s, it) => s + it.line_total, 0);
    const payload = {
      order_number: orderNumber,
      source,
      subtotal,
      total: subtotal,
      delivery: source === "Τηλέφωνο" && delivery?.delivery_type ? delivery : null,
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
      setPrintOrder({ ...saved, restaurant_name: user.restaurant_name });
      setTimeout(() => window.print(), 100);
      toast.success(`Παραγγελία #${saved.order_number} αποθηκεύτηκε`);
      setItems([]);
      setDelivery(null);
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
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] overflow-hidden">
        <section className="p-6 overflow-hidden flex flex-col">
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
          source={source}
          onSourceChange={setSource}
          delivery={delivery}
          setDelivery={setDelivery}
          onIncrement={(id) => updateQty(id, 1)}
          onDecrement={(id) => updateQty(id, -1)}
          onRemove={removeLine}
          onClear={clearOrder}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </main>

      <CustomizationModal
        item={modalItem}
        config={config.customization}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalItem(null);
        }}
        onConfirm={handleConfirmCustomization}
      />
      <Receipt order={printOrder} />
    </AppShell>
  );
}
