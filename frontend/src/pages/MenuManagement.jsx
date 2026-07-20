import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BulkActionsBar from "@/components/BulkActionsBar";
import {
  apiGetMenuConfig,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiCreateItem,
  apiUpdateItem,
  apiDeleteItem,
  apiUpdateCustomization,
  apiReorderCategories,
  apiReorderItems,
  apiListPhotos,
  apiListStockPhotos,
  apiImportStockPhoto,
  formatApiError,
} from "@/lib/api";
import ItemModal from "./menu/ItemModal";
import CustomizationConfigModal from "./menu/CustomizationConfigModal";
import MenuToolbar from "./menu/MenuToolbar";
import CategoriesPanel from "./menu/CategoriesPanel";
import ItemsPanel from "./menu/ItemsPanel";
import { DeleteItemDialog, DeleteCategoryDialog } from "./menu/DeleteDialogs";

// ---------- Main Page ----------
export default function MenuManagement() {
  const [config, setConfig] = useState({ categories: [], items: [], customization: null });
  const [activeCat, setActiveCat] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null);
  const [confirmCat, setConfirmCat] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [stockPhotos, setStockPhotos] = useState([]);
  const [dragCatId, setDragCatId] = useState(null);
  const [dragItemId, setDragItemId] = useState(null);
  const load = async () => {
    try {
      const c = await apiGetMenuConfig();
      setConfig(c);
      try { setPhotos(await apiListPhotos()); } catch {}
      // Κοινή βιβλιοθήκη OrderDeck — μόνο του τύπου του καταστήματος (φιλτράρεται στον server)
      try { setStockPhotos(await apiListStockPhotos()); } catch {}
      if (!activeCat && c.categories.length) setActiveCat(c.categories[0].id);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // Εισαγωγή stock φωτογραφίας → προσωπικό αντίγραφο (idempotent στον server)
  const importStock = async (stockId) => {
    const personal = await apiImportStockPhoto(stockId);
    setPhotos((prev) => (prev.some((p) => p.id === personal.id) ? prev : [personal, ...prev]));
    return personal;
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const c = await apiCreateCategory({ name: newCatName.trim(), order: config.categories.length });
      setConfig((p) => ({ ...p, categories: [...p.categories, c] }));
      setNewCatName("");
      if (!activeCat) setActiveCat(c.id);
      toast.success("Η κατηγορία προστέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveCategoryName = async (cid) => {
    try {
      const cur = config.categories.find((c) => c.id === cid);
      await apiUpdateCategory(cid, { name: editCatName.trim(), order: cur.order });
      setConfig((p) => ({
        ...p,
        categories: p.categories.map((c) => (c.id === cid ? { ...c, name: editCatName.trim() } : c)),
      }));
      setEditingCat(null);
      toast.success("Ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteCategory = (c) => {
    setConfirmCat(c);
  };

  const saveItem = async (form) => {
    try {
      const payload = {
        name: form.name,
        price: form.price,
        category: form.category,
        customizable: !!form.customizable,
        double_meat_eligible: !!form.double_meat_eligible,
        option_groups: form.option_groups || [],
        photo_id: form.photo_id || null,
        allergens: form.allergens || "",
      };
      if (form.id) {
        const upd = await apiUpdateItem(form.id, payload);
        setConfig((p) => ({
          ...p,
          items: p.items.map((i) => (i.id === form.id ? { ...i, ...upd } : i)),
        }));
      } else {
        const created = await apiCreateItem(payload);
        setConfig((p) => ({ ...p, items: [...p.items, created] }));
      }
      setItemModalOpen(false);
      setEditingItem(null);
      toast.success("Αποθηκεύτηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const confirmDeleteItem = async () => {
    if (!confirmItem) return;
    try {
      await apiDeleteItem(confirmItem.id);
      setConfig((p) => ({ ...p, items: p.items.filter((i) => i.id !== confirmItem.id) }));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setConfirmItem(null);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!confirmCat) return;
    try {
      await apiDeleteCategory(confirmCat.id);
      setConfig((p) => ({
        ...p,
        categories: p.categories.filter((c) => c.id !== confirmCat.id),
        items: p.items.filter((i) => i.category !== confirmCat.id),
      }));
      if (activeCat === confirmCat.id) setActiveCat(config.categories[0]?.id || null);
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setConfirmCat(null);
    }
  };

  const saveCustomization = async (payload) => {
    try {
      const upd = await apiUpdateCustomization(payload);
      setConfig((p) => ({ ...p, customization: upd }));
      setCustModalOpen(false);
      toast.success("Ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filteredItems = config.items.filter((i) => i.category === activeCat);

  // ---------- Αναδιάταξη (optimistic UI + αυτόματη αποθήκευση) ----------
  const persistCategoryOrder = async (newCats) => {
    setConfig((p) => ({ ...p, categories: newCats }));
    try {
      await apiReorderCategories(newCats.map((c) => c.id));
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
  };

  const moveCategory = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= config.categories.length) return;
    const arr = [...config.categories];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    persistCategoryOrder(arr);
  };

  const dropCategory = (targetId) => {
    if (!dragCatId || dragCatId === targetId) return;
    const arr = [...config.categories];
    const from = arr.findIndex((c) => c.id === dragCatId);
    const to = arr.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    persistCategoryOrder(arr);
  };

  const persistItemOrder = async (newList) => {
    setConfig((p) => ({
      ...p,
      items: [...p.items.filter((i) => i.category !== activeCat), ...newList],
    }));
    try {
      await apiReorderItems(newList.map((i) => i.id));
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
  };

  const moveItem = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= filteredItems.length) return;
    const arr = [...filteredItems];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    persistItemOrder(arr);
  };

  const dropItem = (targetId) => {
    if (!dragItemId || dragItemId === targetId) return;
    const arr = [...filteredItems];
    const from = arr.findIndex((i) => i.id === dragItemId);
    const to = arr.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    persistItemOrder(arr);
  };
  const selectedInView = filteredItems.filter((i) => selectedIds.includes(i.id));
  const allSelected = filteredItems.length > 0 && selectedInView.length === filteredItems.length;

  const toggleSelect = (id) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((p) => p.filter((id) => !filteredItems.some((it) => it.id === id)));
    } else {
      const catIds = filteredItems.map((i) => i.id);
      setSelectedIds((p) => Array.from(new Set([...p, ...catIds])));
    }
  };

  const clearSelection = () => setSelectedIds([]);
  const exitEdit = () => {
    setEditMode(false);
    clearSelection();
  };
  const refreshAfterBulk = async () => {
    await load();
    clearSelection();
  };

  return (
    <AppShell title="Διαχείριση Μενού">
      <MenuToolbar
        editMode={editMode}
        exitEdit={exitEdit}
        setEditMode={setEditMode}
        setCustModalOpen={setCustModalOpen}
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 md:gap-6">
        {/* Categories */}
        <CategoriesPanel
          config={config}
          newCatName={newCatName}
          setNewCatName={setNewCatName}
          addCategory={addCategory}
          editingCat={editingCat}
          setEditingCat={setEditingCat}
          editCatName={editCatName}
          setEditCatName={setEditCatName}
          saveCategoryName={saveCategoryName}
          deleteCategory={deleteCategory}
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          editMode={editMode}
          dragCatId={dragCatId}
          setDragCatId={setDragCatId}
          dropCategory={dropCategory}
          moveCategory={moveCategory}
        />

        {/* Items */}
        <ItemsPanel
          config={config}
          activeCat={activeCat}
          filteredItems={filteredItems}
          editMode={editMode}
          selectedIds={selectedIds}
          allSelected={allSelected}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          setEditingItem={setEditingItem}
          setItemModalOpen={setItemModalOpen}
          setConfirmItem={setConfirmItem}
          dragItemId={dragItemId}
          setDragItemId={setDragItemId}
          dropItem={dropItem}
          moveItem={moveItem}
        />
      </main>

      {editMode && (
        <div className="px-6 pb-6 max-w-[1400px] mx-auto w-full">
          <BulkActionsBar
            selected={selectedIds}
            categories={config.categories}
            onDone={refreshAfterBulk}
            onClear={clearSelection}
          />
        </div>
      )}

      <ItemModal
        open={itemModalOpen}
        initial={editingItem}
        categories={config.categories}
        photos={photos}
        stockPhotos={stockPhotos}
        onImportStock={importStock}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={saveItem}
      />

      <CustomizationConfigModal
        open={custModalOpen}
        config={config.customization}
        onClose={() => setCustModalOpen(false)}
        onSave={saveCustomization}
      />

      <DeleteItemDialog
        confirmItem={confirmItem}
        setConfirmItem={setConfirmItem}
        confirmDeleteItem={confirmDeleteItem}
      />

      <DeleteCategoryDialog
        confirmCat={confirmCat}
        setConfirmCat={setConfirmCat}
        confirmDeleteCategory={confirmDeleteCategory}
      />
    </AppShell>
  );
}
