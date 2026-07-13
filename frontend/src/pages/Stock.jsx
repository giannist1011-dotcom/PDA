import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ShoppingBasket,
  Check,
  Printer,
  Pencil,
  FolderPlus,
  Package,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
  formatApiError,
} from "@/lib/api";

// ---------- Stock row (checkbox = "add to shopping list") ----------
function StockRow({ item, onToggleNeed, onDelete, canEdit }) {
  const needs = !!item.shopping_item_id;
  return (
    <label
      className={`p-4 bg-[#3D1620] border rounded-lg flex items-center gap-4 group cursor-pointer select-none transition-colors ${
        needs
          ? "border-flame bg-flame/5"
          : "border-[#5E2A3A] hover:border-[#7A3E52]"
      }`}
      data-testid={`stock-row-${item.id}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleNeed(item);
        }}
        data-testid={`stock-check-${item.id}`}
        aria-checked={needs}
        role="checkbox"
        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          needs
            ? "bg-brand border-brand"
            : "border-[#7A3E52] hover:border-flame bg-[#2A0E14]"
        }`}
      >
        {needs && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-heading font-semibold truncate ${needs ? "text-white" : "text-neutral-100"}`}>
          {item.name}
        </div>
        {needs && (
          <div className="text-[11px] font-bold uppercase tracking-widest text-flame mt-0.5">
            Στη λίστα αγορών
          </div>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(item);
          }}
          data-testid={`stock-delete-${item.id}`}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-[#FF3B30]"
          title="Διαγραφή"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </label>
  );
}

// ---------- Add item modal ----------
function AddItemModal({ open, onClose, categories, defaultCategoryId, onSubmit }) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");

  useEffect(() => {
    if (open) {
      setName("");
      setCategoryId(defaultCategoryId || (categories[0]?.id ?? ""));
    }
  }, [open, defaultCategoryId, categories]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    await onSubmit({ name: name.trim(), category_id: categoryId });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="stock-item-modal"
    >
      <form
        onSubmit={submit}
        className="bg-[#3D1620] border border-[#5E2A3A] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">Νέο προϊόν αποθέματος</h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Χαρτοπετσέτες"
          data-testid="stock-item-name-input"
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <label className="text-xs uppercase tracking-wider text-neutral-400">Κατηγορία</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="stock-item-category-select"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-item-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#5E2A3A]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            data-testid="stock-item-save-btn"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            Προσθήκη
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------- Add / rename category modal ----------
function CategoryModal({ open, onClose, onSubmit, initialName = "", title }) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="stock-category-modal"
    >
      <form
        onSubmit={submit}
        className="bg-[#3D1620] border border-[#5E2A3A] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">{title}</h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα κατηγορίας</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Καθαριστικά"
          data-testid="stock-category-name-input"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-category-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#5E2A3A]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            data-testid="stock-category-save-btn"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            Αποθήκευση
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------- Print helper ----------
function printShoppingList({ restaurantName, items }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });

  const rows = items
    .map(
      (it) => `
      <li class="row ${it.bought ? "bought" : ""}">
        <span class="check">${it.bought ? "☒" : "☐"}</span>
        <span class="text">${escapeHtml(it.text)}</span>
      </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8" />
<title>Λίστα αγορών — ${escapeHtml(restaurantName || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { font-size: 13px; color: #7A3E52; }
  ul { list-style: none; padding: 0; margin: 0; }
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed #999; font-size: 16px; }
  .row.bought .text { text-decoration: line-through; color: #888; }
  .check { font-size: 20px; width: 22px; text-align: center; }
  .empty { color: #888; font-style: italic; padding: 20px 0; }
  footer { margin-top: 24px; font-size: 11px; color: #888; text-align: right; }
  @media print { body { margin: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>Λίστα αγορών</h1>
    <div class="meta">${escapeHtml(restaurantName || "")} · ${dateStr} · ${timeStr}</div>
  </header>
  ${items.length === 0 ? '<div class="empty">Η λίστα είναι άδεια</div>' : `<ul>${rows}</ul>`}
  <footer>Εκτυπώθηκε από το OrderDeck</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 100));</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) {
    toast.error("Ενεργοποιήστε τα pop-ups για εκτύπωση");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

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
          <section>
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-flame" />
                  <h2 className="font-heading text-2xl font-bold">Απόθεμα καταστήματος</h2>
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  Τσεκάρετε ό,τι τελειώνει και προστίθεται αυτόματα στη λίστα αγορών →
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <>
                    <Button
                      onClick={() => setCatModal({ open: true, editing: null })}
                      data-testid="stock-add-category-btn"
                      className="h-10 bg-[#3D1620] border border-[#5E2A3A] hover:border-flame text-white"
                    >
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Νέα κατηγορία
                    </Button>
                    <Button
                      onClick={() => setItemModal({ open: true })}
                      disabled={categories.length === 0}
                      data-testid="stock-add-item-btn"
                      className="h-10 bg-brand hover:bg-brand-hover"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Νέο προϊόν
                    </Button>
                  </>
                )}
                <div className="text-sm ml-2">
                  <span className="text-neutral-400">Στη λίστα: </span>
                  <span
                    className="font-mono font-bold text-flame"
                    data-testid="needs-count"
                  >
                    {needsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setActiveCat("all")}
                data-testid="stock-filter-all"
                className={`h-10 px-4 rounded-md text-sm font-bold border ${
                  activeCat === "all"
                    ? "bg-brand border-brand text-white"
                    : "bg-[#3D1620] border-[#5E2A3A] text-neutral-300 hover:border-flame"
                }`}
              >
                Όλα ({items.length})
              </button>
              <button
                onClick={() => setActiveCat("needs")}
                data-testid="stock-filter-needs"
                className={`h-10 px-4 rounded-md text-sm font-bold border ${
                  activeCat === "needs"
                    ? "bg-brand border-brand text-white"
                    : "bg-[#3D1620] border-[#5E2A3A] text-neutral-300 hover:border-flame"
                }`}
              >
                Στη λίστα ({needsCount})
              </button>
              {categories.map((c) => {
                const count = items.filter((i) => i.category_id === c.id).length;
                const active = activeCat === c.id;
                return (
                  <div key={c.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => setActiveCat(c.id)}
                      data-testid={`stock-filter-${c.id}`}
                      className={`h-10 px-4 rounded-md text-sm font-bold border ${
                        active
                          ? "bg-brand border-brand text-white"
                          : "bg-[#3D1620] border-[#5E2A3A] text-neutral-300 hover:border-flame"
                      }`}
                    >
                      {c.name} ({count})
                    </button>
                    {canManage && (
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={() => setCatModal({ open: true, editing: c })}
                          data-testid={`stock-cat-edit-${c.id}`}
                          className="p-1.5 text-neutral-400 hover:text-white"
                          title="Μετονομασία"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c)}
                          data-testid={`stock-cat-delete-${c.id}`}
                          className="p-1.5 text-neutral-400 hover:text-[#FF3B30]"
                          title="Διαγραφή"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {loading ? (
              <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
            ) : categories.length === 0 ? (
              <div className="text-neutral-500 py-12 text-center border border-dashed border-[#5E2A3A] rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <div className="mb-2">Δεν έχετε δημιουργήσει κατηγορίες αποθέματος</div>
                {canManage && (
                  <button
                    onClick={() => setCatModal({ open: true, editing: null })}
                    className="text-flame font-bold hover:underline"
                    data-testid="stock-empty-add-category"
                  >
                    Δημιουργήστε την πρώτη κατηγορία
                  </button>
                )}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-neutral-500 py-12 text-center">
                Δεν υπάρχουν προϊόντα σε αυτή την προβολή
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((it) => (
                  <StockRow
                    key={it.id}
                    item={it}
                    onToggleNeed={handleToggleNeed}
                    onDelete={handleDeleteItem}
                    canEdit={canManage}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Shopping list */}
          <aside className="bg-[#3D1620] border border-[#5E2A3A] rounded-lg p-5 h-fit lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="w-5 h-5 text-flame" />
                <h2 className="font-heading text-xl font-bold">Λίστα αγορών</h2>
              </div>
              <button
                onClick={onPrint}
                disabled={shopping.length === 0}
                data-testid="shopping-print-btn"
                className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#2A0E14] border border-[#5E2A3A] text-neutral-200 text-sm font-bold hover:border-flame hover:text-flame disabled:opacity-40 disabled:cursor-not-allowed"
                title="Εκτύπωση & μηδενισμός λίστας"
              >
                <Printer className="w-4 h-4" />
                Εκτύπωση
              </button>
            </div>
            {canManage ? (
              <form onSubmit={addShopItem} className="flex gap-2 mb-4">
                <input
                  value={shopText}
                  onChange={(e) => setShopText(e.target.value)}
                  placeholder="π.χ. 5kg πατάτες"
                  data-testid="shopping-input"
                  className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                />
                <Button
                  type="submit"
                  data-testid="shopping-add-btn"
                  className="h-11 bg-brand hover:bg-brand-hover px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <div className="text-[11px] text-neutral-500 mb-4 uppercase tracking-widest">
                Η χειροκίνητη προσθήκη ειδών είναι διαθέσιμη μόνο σε ιδιοκτήτη
              </div>
            )}

            {shopping.length === 0 ? (
              <div className="text-neutral-500 text-sm text-center py-8">
                Η λίστα είναι άδεια
              </div>
            ) : (
              <ul className="space-y-2">
                {shopping.map((s) => (
                  <li
                    key={s.id}
                    data-testid={`shopping-item-${s.id}`}
                    className="flex items-center gap-3 p-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md group"
                  >
                    <button
                      onClick={() => (canManage ? toggleShopBought(s) : null)}
                      disabled={!canManage}
                      data-testid={`shopping-check-${s.id}`}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 disabled:cursor-not-allowed ${
                        s.bought
                          ? "bg-[#00E676] border-[#00E676]"
                          : "border-[#7A3E52] hover:border-[#00E676]"
                      }`}
                      title={s.bought ? "Αγοράστηκε" : "Σημείωση ως αγορασμένο"}
                    >
                      {s.bought && <Check className="w-4 h-4 text-black" />}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        s.bought ? "line-through text-neutral-500" : "text-white"
                      }`}
                    >
                      {s.text}
                    </span>
                    {s.source_stock_id && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-flame/20 text-flame"
                        title="Από απόθεμα"
                      >
                        Αποθ.
                      </span>
                    )}
                    {canManage && (
                      <button
                        onClick={() => removeShop(s)}
                        data-testid={`shopping-delete-${s.id}`}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-[#FF3B30]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
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
    </AppShell>
  );
}
