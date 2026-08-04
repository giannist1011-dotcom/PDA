import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/shared/AuthContext";
import {
  apiGetStockConfig,
  apiCreateStockCategory,
  apiUpdateStockCategory,
  apiDeleteStockCategory,
  apiReorderStockCategories,
  apiCreateStockItem,
  apiUpdateStockItem,
  apiReorderStockItems,
  apiToggleStockItemShopping,
  apiToggleStockCategoryShopping,
  apiDeleteStockItem,
  apiMergeStockVariants,
  apiListShopping,
  apiAddShopping,
  apiUpdateShopping,
  apiDeleteShopping,
  apiResetShopping,
  apiRecordShoppingPrint,
  formatApiError,
} from "@/lib/api";
import { printShoppingList, groupShoppingByCategory } from "./utils";

// ---------- Όλη η κατάσταση & οι ενέργειες της σελίδας «Ελλείψεις» ----------
// Η σελίδα (Stock.jsx) μένει καθαρό render· εδώ ζουν state, effects και handlers.
export default function useStockPage() {
  const { user, canManage } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [shopText, setShopText] = useState("");
  const [shopCat, setShopCat] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [catModal, setCatModal] = useState({ open: false, editing: null });
  const [itemModal, setItemModal] = useState({ open: false, editing: null });
  const [variantModal, setVariantModal] = useState({ open: false, item: null });
  const [mergeOpen, setMergeOpen] = useState(false);
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

  // Στην «Στη λίστα» βλέπουμε υποσύνολο κάθε κατηγορίας — η αναδιάταξη δεν βγάζει
  // νόημα εκεί, οπότε η επεξεργασία ξεκινά πάντα από πλήρη προβολή.
  const toggleEditMode = (next) => {
    setEditMode((prev) => {
      const val = typeof next === "function" ? next(prev) : next;
      if (val && activeCat === "needs") setActiveCat("all");
      return val;
    });
  };

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
      setShopping((p) =>
        p.map((s) => (s.category_id === id ? { ...s, category_name: name } : s))
      );
      toast.success("Ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteCategory = async (cat) => {
    const itemCount = items.filter((i) => i.category_id === cat.id).length;
    const msg = itemCount
      ? `Διαγραφή κατηγορίας "${cat.name}" και των ${itemCount} ειδών της;`
      : `Διαγραφή κατηγορίας "${cat.name}";`;
    if (!window.confirm(msg)) return;
    try {
      await apiDeleteStockCategory(cat.id);
      setCategories((p) => p.filter((c) => c.id !== cat.id));
      setItems((p) => p.filter((i) => i.category_id !== cat.id));
      if (activeCat === cat.id) setActiveCat("all");
      // Οι εγγραφές της λίστας αγορών μεταφέρθηκαν/διαγράφηκαν στο backend
      const shop = await apiListShopping();
      setShopping(shop);
      toast.success("Κατηγορία διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleMoveCategory = async (idx, dir) => {
    const next = [...categories];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setCategories(next.map((c, i) => ({ ...c, order: i })));
    try {
      await apiReorderStockCategories(next.map((c) => c.id));
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
  };

  // ---- items ----
  const handleSubmitItem = async ({ name, category_id, variants }) => {
    const editing = itemModal.editing;
    try {
      if (editing) {
        const res = await apiUpdateStockItem(editing.id, { name, category_id, variants });
        const nextVariants = res.variants || [];
        const nextSelected = res.selected_variant_ids || [];
        setItems((p) =>
          p.map((i) =>
            i.id === editing.id
              ? {
                  ...i,
                  name,
                  category_id,
                  variants: nextVariants,
                  selected_variant_ids: nextSelected,
                }
              : i
          )
        );
        // Το κείμενο στη λίστα αγορών ξαναφτιάχνεται από το backend — ξαναδιάβασέ τη
        if (editing.shopping_item_id) {
          try {
            setShopping(await apiListShopping());
          } catch {
            /* το επόμενο load θα το διορθώσει */
          }
        } else {
          setShopping((p) =>
            p.map((s) =>
              s.source_stock_id === editing.id
                ? {
                    ...s,
                    category_id,
                    category_name:
                      categories.find((c) => c.id === category_id)?.name || s.category_name,
                  }
                : s
            )
          );
        }
        toast.success("Ενημερώθηκε");
      } else {
        const created = await apiCreateStockItem({
          name,
          category_id,
          variants,
          available: true,
          note: "",
        });
        setItems((p) => [...p, created]);
        toast.success("Είδος προστέθηκε");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleMoveItem = async (item, dir) => {
    const inCat = items.filter((i) => i.category_id === item.category_id);
    const idx = inCat.findIndex((i) => i.id === item.id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= inCat.length) return;
    const next = [...inCat];
    [next[idx], next[to]] = [next[to], next[idx]];
    const orderById = new Map(next.map((i, n) => [i.id, n]));
    setItems((p) =>
      p.map((i) => (orderById.has(i.id) ? { ...i, order: orderById.get(i.id) } : i))
    );
    try {
      await apiReorderStockItems(next.map((i) => i.id));
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
  };

  // Είδος με παραλλαγές → ανοίγει ο picker· χωρίς παραλλαγές → κατευθείαν επιλογή
  const handleToggleNeed = (item) => {
    if ((item.variants || []).length > 0) {
      setVariantModal({ open: true, item });
      return;
    }
    applyNeed(item, !item.shopping_item_id, null);
  };

  const handleConfirmVariants = (variantIds) => {
    const item = variantModal.item;
    if (!item) return;
    applyNeed(item, variantIds.length > 0, variantIds);
  };

  const applyNeed = async (item, needs, variantIds) => {
    const wasNeeded = !!item.shopping_item_id;
    try {
      const res = await apiToggleStockItemShopping(item.id, needs, variantIds);
      setItems((p) =>
        p.map((i) =>
          i.id === item.id
            ? {
                ...i,
                shopping_item_id: res.shopping_item_id,
                selected_variant_ids: res.selected_variant_ids || [],
              }
            : i
        )
      );
      if (res.shopping_item) {
        setShopping((p) => [
          ...p.filter((s) => s.id !== res.shopping_item.id),
          res.shopping_item,
        ]);
        toast.success(`${wasNeeded ? "Ενημερώθηκε" : "Προστέθηκε"}: ${res.shopping_item.text}`);
      } else {
        if (wasNeeded) setShopping((p) => p.filter((s) => s.id !== item.shopping_item_id));
        toast.success("Αφαιρέθηκε από τη λίστα");
      }
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
  };

  // Επιλογή/καθαρισμός ολόκληρης κατηγορίας με μία κίνηση (μία κλήση στο backend)
  const handleToggleCategoryNeeds = async (group, needs) => {
    try {
      const res = await apiToggleStockCategoryShopping(group.id, needs);
      const links = res.links || {};
      const selections = res.selections || {};
      setItems((p) =>
        p.map((i) =>
          Object.prototype.hasOwnProperty.call(links, i.id)
            ? {
                ...i,
                shopping_item_id: links[i.id],
                selected_variant_ids: selections[i.id] ?? i.selected_variant_ids ?? [],
              }
            : i
        )
      );
      if (needs) {
        const created = res.shopping_items || [];
        const ids = new Set(created.map((s) => s.id));
        setShopping((p) => [...p.filter((s) => !ids.has(s.id)), ...created]);
        toast.success(`${group.name}: όλα στη λίστα`);
      } else {
        const cleared = new Set(Object.keys(links));
        setShopping((p) => p.filter((s) => !cleared.has(s.source_stock_id)));
        toast.success(`${group.name}: αφαιρέθηκε από τη λίστα`);
      }
    } catch (e) {
      toast.error(formatApiError(e));
      load();
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

  // Ένωση παλιών ειδών («Σακούλες 35άρες» × 3) σε ένα είδος με παραλλαγές
  const handleMergeVariants = async (groups) => {
    try {
      const res = await apiMergeStockVariants(groups);
      await load();
      toast.success(`${res.merged} είδη μετατράπηκαν σε παραλλαγές`);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ---- shopping ----
  const addShopItem = async (e) => {
    e?.preventDefault();
    if (!shopText.trim()) return;
    try {
      const created = await apiAddShopping(shopText.trim(), shopCat || null);
      setShopping((p) => [...p, created]);
      setShopText("");
    } catch (err) {
      toast.error(formatApiError(err));
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
          i.id === shop.source_stock_id
            ? { ...i, shopping_item_id: null, selected_variant_ids: [] }
            : i
        )
      );
    }
    try {
      await apiDeleteShopping(shop.id);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // Είδη ανά κατηγορία, με βάση το ενεργό φίλτρο — ίδια δομή με τον κατάλογο
  const groups = useMemo(() => {
    const visible =
      activeCat === "needs" ? items.filter((i) => !!i.shopping_item_id) : items;
    return categories
      .filter((c) => activeCat === "all" || activeCat === "needs" || activeCat === c.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: visible.filter((i) => i.category_id === c.id),
      }))
      // Κενές κατηγορίες μένουν ορατές στην επεξεργασία (για να τις διαχειριστείς)
      .filter((g) => g.items.length > 0 || editMode || activeCat === g.id);
  }, [items, categories, activeCat, editMode]);

  const shoppingGroups = useMemo(
    () => groupShoppingByCategory(shopping, categories),
    [shopping, categories]
  );

  const needsCount = items.filter((i) => !!i.shopping_item_id).length;
  const restaurantName = user?.restaurant_name || "";

  const onPrint = async () => {
    if (shopping.length === 0) return;
    // Snapshot then print
    const snapshot = [...shopping];
    printShoppingList({ user, restaurantName, items: snapshot, categories });
    // Καταγραφή στο ιστορικό εκτυπώσεων (ποιος/πότε/τι) — δεν μπλοκάρει την εκτύπωση
    try {
      await apiRecordShoppingPrint(
        snapshot.map((s) => ({
          text: s.text,
          bought: !!s.bought,
          category: s.category_name || "",
        }))
      );
    } catch {
      toast.error("Η εκτύπωση δεν αποθηκεύτηκε στο ιστορικό");
    }
    // Reset backend + local state so next print starts fresh
    try {
      await apiResetShopping();
      setShopping([]);
      setItems((p) =>
        p.map((i) =>
          i.shopping_item_id ? { ...i, shopping_item_id: null, selected_variant_ids: [] } : i
        )
      );
      toast.success("Η λίστα εκτυπώθηκε και μηδενίστηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return {
    user,
    canManage,
    restaurantName,
    categories,
    items,
    shopping,
    shoppingGroups,
    groups,
    needsCount,
    loading,
    activeCat,
    setActiveCat,
    editMode,
    toggleEditMode,
    shopText,
    setShopText,
    shopCat,
    setShopCat,
    catModal,
    setCatModal,
    itemModal,
    setItemModal,
    variantModal,
    setVariantModal,
    mergeOpen,
    setMergeOpen,
    historyOpen,
    setHistoryOpen,
    handleCreateCategory,
    handleRenameCategory,
    handleDeleteCategory,
    handleMoveCategory,
    handleSubmitItem,
    handleMoveItem,
    handleToggleNeed,
    handleConfirmVariants,
    handleToggleCategoryNeeds,
    handleDeleteItem,
    handleMergeVariants,
    addShopItem,
    toggleShopBought,
    removeShop,
    onPrint,
  };
}
