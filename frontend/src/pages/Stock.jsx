import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ShoppingBasket,
  PackageX,
  Check,
  Printer,
  Pencil,
  FolderPlus,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetStockConfig,
  apiCreateStockCategory,
  apiUpdateStockCategory,
  apiDeleteStockCategory,
  apiCreateStockItem,
  apiUpdateStockItem,
  apiDeleteStockItem,
  apiListShopping,
  apiAddShopping,
  apiUpdateShopping,
  apiDeleteShopping,
  formatApiError,
} from "@/lib/api";

// ---------- Stock row ----------
function StockRow({ item, onToggle, onNote, onDelete, canEdit }) {
  const [noteEdit, setNoteEdit] = useState(item.note || "");
  const unavailable = item.available === false;

  useEffect(() => {
    setNoteEdit(item.note || "");
  }, [item.note]);

  const persistNote = async () => {
    if (noteEdit === (item.note || "")) return;
    await onNote(item.id, noteEdit);
  };

  return (
    <div
      className={`p-4 bg-[#1A1A1A] border rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 group ${
        unavailable ? "border-[#FF3B30]/50" : "border-[#333]"
      }`}
      data-testid={`stock-row-${item.id}`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="min-w-0">
          <div className="font-heading font-semibold text-white truncate">{item.name}</div>
        </div>
        {unavailable && (
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
            Έλλειψη
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {unavailable && (
          <input
            value={noteEdit}
            onChange={(e) => setNoteEdit(e.target.value)}
            onBlur={persistNote}
            placeholder="π.χ. τελειώνει αύριο"
            data-testid={`stock-note-${item.id}`}
            className="w-48 h-10 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-sm text-white focus:outline-none focus:border-[#FF6B00]"
          />
        )}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold ${
              unavailable ? "text-neutral-500" : "text-[#00E676]"
            }`}
          >
            {unavailable ? "Μη διαθέσιμο" : "Διαθέσιμο"}
          </span>
          <Switch
            checked={!unavailable}
            onCheckedChange={() => onToggle(item)}
            data-testid={`stock-toggle-${item.id}`}
          />
        </div>
        {canEdit && (
          <button
            onClick={() => onDelete(item)}
            data-testid={`stock-delete-${item.id}`}
            className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-[#FF3B30]"
            title="Διαγραφή"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
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
        className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">Νέο προϊόν αποθέματος</h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Χαρτοπετσέτες"
          data-testid="stock-item-name-input"
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
        />
        <label className="text-xs uppercase tracking-wider text-neutral-400">Κατηγορία</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="stock-item-category-select"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
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
            className="h-10 px-4 rounded-md bg-[#2A2A2A] text-neutral-300 text-sm font-bold hover:bg-[#333]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            data-testid="stock-item-save-btn"
            className="h-10 bg-[#FF6B00] hover:bg-[#FF8533] px-4"
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
        className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">{title}</h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα κατηγορίας</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Καθαριστικά"
          data-testid="stock-category-name-input"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-category-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#2A2A2A] text-neutral-300 text-sm font-bold hover:bg-[#333]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            data-testid="stock-category-save-btn"
            className="h-10 bg-[#FF6B00] hover:bg-[#FF8533] px-4"
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
  .meta { font-size: 13px; color: #555; }
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
  <footer>Εκτυπώθηκε από το POS Πεινώκιο</footer>
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
  const { user, isOwner } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [shopText, setShopText] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);

  // modals
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
      setCategories((p) => p.filter((c) => c.id !== cat.id));
      setItems((p) => p.filter((i) => i.category_id !== cat.id));
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

  const toggleAvailability = async (item) => {
    const nextAvail = item.available === false;
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, available: nextAvail } : i)));
    try {
      await apiUpdateStockItem(item.id, {
        available: nextAvail,
        note: nextAvail ? "" : item.note || "",
      });
    } catch (e) {
      toast.error(formatApiError(e));
      setItems((p) => p.map((i) => (i.id === item.id ? { ...i, available: !nextAvail } : i)));
    }
  };

  const setNote = async (id, note) => {
    setItems((p) => p.map((i) => (i.id === id ? { ...i, note } : i)));
    try {
      await apiUpdateStockItem(id, { note });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Διαγραφή "${item.name}";`)) return;
    try {
      await apiDeleteStockItem(item.id);
      setItems((p) => p.filter((i) => i.id !== item.id));
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

  const toggleShop = async (item) => {
    const next = !item.bought;
    setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, bought: next } : s)));
    try {
      await apiUpdateShopping(item.id, { bought: next });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const removeShop = async (id) => {
    setShopping((p) => p.filter((s) => s.id !== id));
    try {
      await apiDeleteShopping(id);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filteredItems = useMemo(() => {
    if (activeCat === "all") return items;
    if (activeCat === "unavailable") return items.filter((i) => i.available === false);
    return items.filter((i) => i.category_id === activeCat);
  }, [items, activeCat]);

  const unavailableCount = items.filter((i) => i.available === false).length;
  const restaurantName = user?.restaurant_name || "";

  const onPrint = () => printShoppingList({ restaurantName, items: shopping });

  return (
    <AppShell title="Ελλείψεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Stock section */}
          <section>
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <PackageX className="w-5 h-5 text-[#FF6B00]" />
                  <h2 className="font-heading text-2xl font-bold">Απόθεμα καταστήματος</h2>
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  Προσθέστε δικές σας κατηγορίες (π.χ. Καθαριστικά, Συσκευασία) και προϊόντα για παρακολούθηση αποθέματος
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Button
                      onClick={() => setCatModal({ open: true, editing: null })}
                      data-testid="stock-add-category-btn"
                      className="h-10 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white"
                    >
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Νέα κατηγορία
                    </Button>
                    <Button
                      onClick={() => setItemModal({ open: true })}
                      disabled={categories.length === 0}
                      data-testid="stock-add-item-btn"
                      className="h-10 bg-[#FF6B00] hover:bg-[#FF8533]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Νέο προϊόν
                    </Button>
                  </>
                )}
                <div className="text-sm ml-2">
                  <span className="text-neutral-400">Ελλείψεις: </span>
                  <span
                    className="font-mono font-bold text-[#FF6961]"
                    data-testid="unavailable-count"
                  >
                    {unavailableCount}
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
                    ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                    : "bg-[#1A1A1A] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                }`}
              >
                Όλα ({items.length})
              </button>
              <button
                onClick={() => setActiveCat("unavailable")}
                data-testid="stock-filter-unavailable"
                className={`h-10 px-4 rounded-md text-sm font-bold border ${
                  activeCat === "unavailable"
                    ? "bg-[#FF3B30] border-[#FF3B30] text-white"
                    : "bg-[#1A1A1A] border-[#333] text-neutral-300 hover:border-[#FF3B30]"
                }`}
              >
                Ελλείψεις ({unavailableCount})
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
                          ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                          : "bg-[#1A1A1A] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                      }`}
                    >
                      {c.name} ({count})
                    </button>
                    {isOwner && (
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
              <div className="text-neutral-500 py-12 text-center border border-dashed border-[#333] rounded-lg">
                <PackageX className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <div className="mb-2">Δεν έχετε δημιουργήσει κατηγορίες αποθέματος</div>
                {isOwner && (
                  <button
                    onClick={() => setCatModal({ open: true, editing: null })}
                    className="text-[#FF6B00] font-bold hover:underline"
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
                    onToggle={toggleAvailability}
                    onNote={setNote}
                    onDelete={handleDeleteItem}
                    canEdit={isOwner}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Shopping list */}
          <aside className="bg-[#1A1A1A] border border-[#333] rounded-lg p-5 h-fit lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="w-5 h-5 text-[#FF6B00]" />
                <h2 className="font-heading text-xl font-bold">Λίστα αγορών</h2>
              </div>
              <button
                onClick={onPrint}
                disabled={shopping.length === 0}
                data-testid="shopping-print-btn"
                className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#0D0D0D] border border-[#333] text-neutral-200 text-sm font-bold hover:border-[#FF6B00] hover:text-[#FF6B00] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Εκτύπωση λίστας"
              >
                <Printer className="w-4 h-4" />
                Εκτύπωση
              </button>
            </div>
            <form onSubmit={addShopItem} className="flex gap-2 mb-4">
              <input
                value={shopText}
                onChange={(e) => setShopText(e.target.value)}
                placeholder="π.χ. 5kg πατάτες"
                data-testid="shopping-input"
                className="flex-1 h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
              />
              <Button
                type="submit"
                data-testid="shopping-add-btn"
                className="h-11 bg-[#FF6B00] hover:bg-[#FF8533] px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </form>

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
                    className="flex items-center gap-3 p-3 bg-[#0D0D0D] border border-[#333] rounded-md group"
                  >
                    <button
                      onClick={() => toggleShop(s)}
                      data-testid={`shopping-check-${s.id}`}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                        s.bought
                          ? "bg-[#00E676] border-[#00E676]"
                          : "border-[#555] hover:border-[#FF6B00]"
                      }`}
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
                    <button
                      onClick={() => removeShop(s.id)}
                      data-testid={`shopping-delete-${s.id}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-[#FF3B30]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
        defaultCategoryId={activeCat !== "all" && activeCat !== "unavailable" ? activeCat : ""}
        onSubmit={handleCreateItem}
      />
    </AppShell>
  );
}
