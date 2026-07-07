import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3, Utensils, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import MenuGrid from "@/components/MenuGrid";
import OrderPanel from "@/components/OrderPanel";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
      await loadNext();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0D0D] text-neutral-400">
        Φόρτωση μενού...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0D0D0D] text-white overflow-hidden">
      <header className="flex items-center justify-between px-6 h-16 border-b border-[#333] bg-[#0D0D0D] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#FF6B00] flex items-center justify-center">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-heading text-2xl font-bold tracking-tight"
              data-testid="restaurant-name"
            >
              {user?.restaurant_name || "POS"}
            </span>
            <span className="text-xs uppercase tracking-widest text-neutral-500">POS</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/menu"
            data-testid="nav-menu-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-200 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-bold hidden md:inline">Διαχείριση μενού</span>
          </Link>
          <Link
            to="/analytics"
            data-testid="nav-analytics-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-200 hover:text-white transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-bold hidden md:inline">Στατιστικά</span>
          </Link>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF3B30] text-neutral-300 hover:text-[#FF3B30] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

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
    </div>
  );
}
