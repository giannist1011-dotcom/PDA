import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetStockConfig,
  apiCreateStockCategory,
  apiUpdateStockCategory,
  apiDeleteStockCategory,
  apiCreateStockItem,
  apiToggleStockItemShopping,
  apiDeleteStockItem,
  apiListShopping,
  apiAddShopping,
  apiUpdateShopping,
  apiDeleteShopping,
  apiResetShopping,
  apiRecordShoppingPrint,
  formatApiError,
} from "@/lib/api";
import AddItemModal from "./stock/AddItemModal";
import CategoryModal from "./stock/CategoryModal";
import StockSection from "./stock/StockSection";
import ShoppingListPanel from "./stock/ShoppingListPanel";
import PrintHistoryModal from "./stock/PrintHistoryModal";
import { printShoppingList } from "./stock/utils";

// ---------- Main page ----------
export default function Stock() {
  const { user, canManage } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [shopText, setShopText] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);

  const [catModal, setCatModal] = useState({ open: false, editing: null });
  const [itemModal, setItemModal] = useState({ open: false });
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = async () => {
    try {
      const [cfg, shop] = await Promise.all([apiGetStockConfig(), apiListShopping()]);
      setCategories(cfg.categories || []);
      setItems(cfg.items || []);
      setShopping(shop);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---- categories ----
  const handleCreateCategory = async (name) => {
    try {
      const created = await apiCreateStockCategory({ name, order: categories.length });
      setCategories((p) => [...p, created]);
      toast.success("Κατηγορία προστέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleRenameCategory = async (id, name) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    try {
      await apiUpdateStockCategory(id, { name, order: cat.order || 0 });
      setCategories((p) => p.map((c) => (c.id === id ? { ...c, name } : c)));
      toast.success("Ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteCategory = async (cat) => {
    const itemCount = items.filter((i) => i.category_id === cat.id).length;
    const msg = itemCount
      ? `Διαγραφή κατηγορίας "${cat.name}" και των ${itemCount} προϊόντων της;`
      : `Διαγραφή κατηγορίας "${cat.name}";`;
    if (!window.confirm(msg)) return;
    try {
      await apiDeleteStockCategory(cat.id);
      const removedIds = new Set(items.filter((i) => i.category_id === cat.id).map((i) => i.id));
      setCategories((p) => p.filter((c) => c.id !== cat.id));
      setItems((p) => p.filter((i) => i.category_id !== cat.id));
      // remove any shopping entries linked to those stock items
      setShopping((p) => p.filter((s) => !s.source_stock_id || !removedIds.has(s.source_stock_id)));
      if (activeCat === cat.id) setActiveCat("all");
      toast.success("Κατηγορία διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ---- items ----
  const handleCreateItem = async ({ name, category_id }) => {
    try {
      const created = await apiCreateStockItem({ name, category_id, available: true, note: "" });
      setItems((p) => [...p, created]);
      toast.success("Προϊόν προστέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleToggleNeed = async (item) => {
    const wasNeeded = !!item.shopping_item_id;
    const optimisticId = wasNeeded ? null : `pending-${item.id}`;
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, shopping_item_id: optimisticId } : i)));
    if (wasNeeded) {
      setShopping((p) => p.filter((s) => s.id !== item.shopping_item_id));
    }
    try {
      const res = await apiToggleStockItemShopping(item.id, !wasNeeded);
      setItems((p) =>
        p.map((i) => (i.id === item.id ? { ...i, shopping_item_id: res.shopping_item_id } : i))
      );
      if (!wasNeeded && res.shopping_item) {
        setShopping((p) => [
          ...p.filter((s) => s.id !== res.shopping_item.id),
          res.shopping_item,
        ]);
        toast.success(`Προστέθηκε: ${item.name}`);
      } else if (wasNeeded) {
        toast.success(`Αφαιρέθηκε από τη λίστα`);
      }
    } catch (e) {
      // revert
      setItems((p) => p.map((i) => (i.id === item.id ? { ...i, shopping_item_id: item.shopping_item_id } : i)));
      if (wasNeeded) {
        // put shopping entry back — refetch to be safe
        try {
          const shop = await apiListShopping();
          setShopping(shop);
        } catch (_err) {
          /* ignore refetch errors */
        }
      }
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Διαγραφή "${item.name}";`)) return;
    try {
      await apiDeleteStockItem(item.id);
      setItems((p) => p.filter((i) => i.id !== item.id));
      if (item.shopping_item_id) {
        setShopping((p) => p.filter((s) => s.id !== item.shopping_item_id));
      }
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ---- shopping ----
  const addShopItem = async (e) => {
    e?.preventDefault();
    if (!shopText.trim()) return;
    try {
      const created = await apiAddShopping(shopText.trim());
      setShopping((p) => [...p, created]);
      setShopText("");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const toggleShopBought = async (item) => {
    const next = !item.bought;
    setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, bought: next } : s)));
    try {
      await apiUpdateShopping(item.id, { bought: next });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const removeShop = async (shop) => {
    setShopping((p) => p.filter((s) => s.id !== shop.id));
    // if linked to a stock item, uncheck that item too
    if (shop.source_stock_id) {
      setItems((p) =>
        p.map((i) =>
          i.id === shop.source_stock_id ? { ...i, shopping_item_id: null } : i
        )
      );
    }
    try {
      await apiDeleteShopping(shop.id);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filteredItems = useMemo(() => {
    if (activeCat === "all") return items;
    if (activeCat === "needs") return items.filter((i) => !!i.shopping_item_id);
    return items.filter((i) => i.category_id === activeCat);
  }, [items, activeCat]);

  const needsCount = items.filter((i) => !!i.shopping_item_id).length;
  const restaurantName = user?.restaurant_name || "";

  const onPrint = async () => {
    if (shopping.length === 0) return;
    // Snapshot then print
    const snapshot = [...shopping];
    printShoppingList({ restaurantName, items: snapshot });
    // Καταγραφή στο ιστορικό εκτυπώσεων (ποιος/πότε/τι) — δεν μπλοκάρει την εκτύπωση
    try {
      await apiRecordShoppingPrint(
        snapshot.map((s) => ({ text: s.text, bought: !!s.bought }))
      );
    } catch {
      toast.error("Η εκτύπωση δεν αποθηκεύτηκε στο ιστορικό");
    }
    // Reset backend + local state so next print starts fresh
    try {
      await apiResetShopping();
      setShopping([]);
      setItems((p) => p.map((i) => (i.shopping_item_id ? { ...i, shopping_item_id: null } : i)));
      toast.success("Η λίστα εκτυπώθηκε και μηδενίστηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <AppShell title="Ελλείψεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Stock section */}
          <StockSection
            canManage={canManage}
            categories={categories}
            items={items}
            needsCount={needsCount}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            setCatModal={setCatModal}
            setItemModal={setItemModal}
            handleDeleteCategory={handleDeleteCategory}
            loading={loading}
            filteredItems={filteredItems}
            handleToggleNeed={handleToggleNeed}
            handleDeleteItem={handleDeleteItem}
          />

          {/* Shopping list */}
          <ShoppingListPanel
            shopping={shopping}
            canManage={canManage}
            shopText={shopText}
            setShopText={setShopText}
            addShopItem={addShopItem}
            toggleShopBought={toggleShopBought}
            removeShop={removeShop}
            onPrint={onPrint}
            onHistory={() => setHistoryOpen(true)}
          />
        </div>
      </main>

      <CategoryModal
        open={catModal.open}
        onClose={() => setCatModal({ open: false, editing: null })}
        onSubmit={(name) =>
          catModal.editing
            ? handleRenameCategory(catModal.editing.id, name)
            : handleCreateCategory(name)
        }
        initialName={catModal.editing?.name || ""}
        title={catModal.editing ? "Μετονομασία κατηγορίας" : "Νέα κατηγορία"}
      />
      <AddItemModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false })}
        categories={categories}
        defaultCategoryId={activeCat !== "all" && activeCat !== "needs" ? activeCat : ""}
        onSubmit={handleCreateItem}
      />
      <PrintHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        restaurantName={restaurantName}
      />
    </AppShell>
  );
}
