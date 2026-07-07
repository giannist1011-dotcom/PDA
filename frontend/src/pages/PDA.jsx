import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3, Utensils } from "lucide-react";
import MenuGrid from "@/components/MenuGrid";
import OrderPanel from "@/components/OrderPanel";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
import { CATEGORIES, ORDER_SOURCES } from "@/data/menu";
import { fetchNextOrderNumber, submitOrder } from "@/lib/api";

let LINE_ID = 1;
const newLineId = () => `L${Date.now()}-${LINE_ID++}`;

export default function PDA() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [orderNumber, setOrderNumber] = useState(0);
  const [source, setSource] = useState(ORDER_SOURCES[0]);
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);

  const loadNextNumber = async () => {
    try {
      const n = await fetchNextOrderNumber();
      setOrderNumber(n);
    } catch (e) {
      console.error(e);
      setOrderNumber(1);
    }
  };

  useEffect(() => {
    loadNextNumber();
  }, []);

  const addLine = (item, customization = null, unitPriceOverride = null) => {
    const unit_price = unitPriceOverride ?? item.price;
    const line = {
      line_id: newLineId(),
      item_id: item.id,
      name: item.name,
      category: item.category,
      unit_price,
      quantity: 1,
      line_total: unit_price,
      customization,
    };
    setItems((prev) => [...prev, line]);
  };

  const handleItemClick = (item) => {
    if (item.customizable) {
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
      prev
        .map((it) =>
          it.line_id === lineId
            ? {
                ...it,
                quantity: Math.max(1, it.quantity + delta),
                line_total: it.unit_price * Math.max(1, it.quantity + delta),
              }
            : it
        )
        .filter(Boolean)
    );
  };

  const removeLine = (lineId) => {
    setItems((prev) => prev.filter((it) => it.line_id !== lineId));
  };

  const clearOrder = () => {
    setItems([]);
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    const subtotal = items.reduce((s, it) => s + it.line_total, 0);
    const payload = {
      order_number: orderNumber,
      source,
      items: items.map((it) => ({
        item_id: it.item_id,
        name: it.name,
        category: it.category,
        unit_price: it.unit_price,
        quantity: it.quantity,
        line_total: it.line_total,
        customization: it.customization,
      })),
      subtotal,
      total: subtotal,
    };
    try {
      const saved = await submitOrder(payload);
      setPrintOrder(saved);
      // print
      setTimeout(() => {
        window.print();
      }, 100);
      // reset
      toast.success(`Παραγγελία #${saved.order_number} αποθηκεύτηκε`);
      setItems([]);
      await loadNextNumber();
    } catch (e) {
      console.error(e);
      toast.error("Σφάλμα κατά την αποθήκευση");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0D0D0D] text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-[#333] bg-[#0D0D0D] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#FF6B00] flex items-center justify-center">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-heading text-2xl font-bold tracking-tight"
              data-testid="app-title"
            >
              Πεινώκιο
            </span>
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              POS
            </span>
          </div>
        </div>
        <Link
          to="/analytics"
          data-testid="nav-analytics-btn"
          className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-200 hover:text-white transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm font-bold">Στατιστικά</span>
        </Link>
      </header>

      {/* Main layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] overflow-hidden">
        <section className="p-6 overflow-hidden flex flex-col">
          <MenuGrid
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
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalItem(null);
        }}
        onConfirm={handleConfirmCustomization}
      />

      <Receipt order={printOrder} />
    </div>
  );
}
