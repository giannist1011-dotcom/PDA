import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBasket, PackageX, Check } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  apiGetMenuConfig,
  apiSetItemAvailability,
  apiListShopping,
  apiAddShopping,
  apiUpdateShopping,
  apiDeleteShopping,
  formatApiError,
} from "@/lib/api";

// ---------- item row ----------
function StockRow({ item, onToggle, onNote }) {
  const [noteEdit, setNoteEdit] = useState(item.unavailable_note || "");
  const [saving, setSaving] = useState(false);
  const unavailable = item.available === false;

  useEffect(() => {
    setNoteEdit(item.unavailable_note || "");
  }, [item.unavailable_note]);

  const persistNote = async () => {
    if (noteEdit === (item.unavailable_note || "")) return;
    setSaving(true);
    try {
      await onNote(item.id, noteEdit);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`p-4 bg-[#1A1A1A] border rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
        unavailable ? "border-[#FF3B30]/50" : "border-[#333]"
      }`}
      data-testid={`stock-row-${item.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-heading font-semibold text-white truncate">{item.name}</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {item.price?.toFixed(2).replace(".", ",")}€
            </div>
          </div>
          {unavailable && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
              Έλλειψη
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {unavailable && (
          <input
            value={noteEdit}
            onChange={(e) => setNoteEdit(e.target.value)}
            onBlur={persistNote}
            placeholder="π.χ. τελειώνει αύριο"
            data-testid={`note-${item.id}`}
            className="w-56 h-10 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-sm text-white focus:outline-none focus:border-[#FF6B00]"
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
            data-testid={`toggle-${item.id}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function Stock() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [shopText, setShopText] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [config, shop] = await Promise.all([apiGetMenuConfig(), apiListShopping()]);
      setItems(config.items);
      setCategories(config.categories);
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

  const toggleAvailability = async (item) => {
    const newAvailable = item.available === false; // flipping
    // optimistic
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, available: newAvailable } : i))
    );
    try {
      await apiSetItemAvailability(item.id, {
        available: newAvailable,
        unavailable_note: newAvailable ? "" : item.unavailable_note || "",
      });
      toast.success(newAvailable ? "Επισημάνθηκε διαθέσιμο" : "Επισημάνθηκε ως έλλειψη");
    } catch (e) {
      toast.error(formatApiError(e));
      // revert
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, available: !newAvailable } : i))
      );
    }
  };

  const setNote = async (id, note) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, unavailable_note: note } : i)));
    try {
      const it = items.find((x) => x.id === id);
      await apiSetItemAvailability(id, {
        available: it?.available !== false,
        unavailable_note: note,
      });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const addShopItem = async (e) => {
    e?.preventDefault();
    if (!shopText.trim()) return;
    try {
      const created = await apiAddShopping(shopText.trim());
      setShopping((prev) => [...prev, created]);
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
    return items.filter((i) => i.category === activeCat);
  }, [items, activeCat]);

  const unavailableCount = items.filter((i) => i.available === false).length;

  return (
    <AppShell title="Ελλείψεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Stock section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <PackageX className="w-5 h-5 text-[#FF6B00]" />
                  <h2 className="font-heading text-2xl font-bold">Διαθεσιμότητα προϊόντων</h2>
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  Απενεργοποιήστε προϊόντα που τελείωσαν — δεν θα εμφανίζονται στο PDA
                </p>
              </div>
              <div className="text-sm">
                <span className="text-neutral-400">Ελλείψεις: </span>
                <span
                  className="font-mono font-bold text-[#FF6961]"
                  data-testid="unavailable-count"
                >
                  {unavailableCount}
                </span>
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
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  data-testid={`stock-filter-${c.id}`}
                  className={`h-10 px-4 rounded-md text-sm font-bold border ${
                    activeCat === c.id
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "bg-[#1A1A1A] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-neutral-500 py-12 text-center">Δεν υπάρχουν προϊόντα</div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((it) => (
                  <StockRow key={it.id} item={it} onToggle={toggleAvailability} onNote={setNote} />
                ))}
              </div>
            )}
          </section>

          {/* Shopping list */}
          <aside className="bg-[#1A1A1A] border border-[#333] rounded-lg p-5 h-fit lg:sticky lg:top-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBasket className="w-5 h-5 text-[#FF6B00]" />
              <h2 className="font-heading text-xl font-bold">Λίστα αγορών</h2>
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
    </AppShell>
  );
}
