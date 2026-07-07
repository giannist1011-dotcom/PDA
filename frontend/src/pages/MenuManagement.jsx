import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  apiGetMenuConfig,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiCreateItem,
  apiUpdateItem,
  apiDeleteItem,
  apiUpdateCustomization,
  formatApiError,
} from "@/lib/api";
import { eur } from "@/lib/format";

const emptyItem = (categoryId = "") => ({
  id: null,
  name: "",
  price: "",
  category: categoryId,
  customizable: false,
  double_meat_eligible: false,
});

// ---------- Item Modal ----------
function ItemModal({ open, initial, categories, onClose, onSave }) {
  const [form, setForm] = useState(initial || emptyItem());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(initial || emptyItem(categories[0]?.id || ""));
  }, [initial, open, categories]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        ...form,
        price: parseFloat(String(form.price).replace(",", ".")) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0D0D] border-[#333] text-white" data-testid="item-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {form.id ? "Επεξεργασία προϊόντος" : "Νέο προϊόν"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Όνομα
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="item-name-input"
              className="w-full h-11 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Τιμή (€)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.10"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                data-testid="item-price-input"
                className="w-full h-11 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Κατηγορία
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                data-testid="item-category-select"
                className="w-full h-11 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border border-[#333] rounded-md">
            <div>
              <div className="font-semibold text-sm">Παραμετροποιήσιμο</div>
              <div className="text-xs text-neutral-500">Ανοίγει modal για ψωμί/σως</div>
            </div>
            <Switch
              checked={form.customizable}
              onCheckedChange={(v) => setForm({ ...form, customizable: !!v })}
              data-testid="item-customizable-switch"
            />
          </div>
          {form.customizable && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border border-[#333] rounded-md">
              <div>
                <div className="font-semibold text-sm">Επιδέχεται διπλή μερίδα κρέας</div>
                <div className="text-xs text-neutral-500">Επιπλέον χρέωση διπλού κρέατος</div>
              </div>
              <Switch
                checked={form.double_meat_eligible}
                onCheckedChange={(v) => setForm({ ...form, double_meat_eligible: !!v })}
                data-testid="item-doublemeat-switch"
              />
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="item-save-btn"
              className="bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
            >
              <Save className="w-4 h-4 mr-2" /> Αποθήκευση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Customization Modal ----------
function CustomizationConfigModal({ open, config, onClose, onSave }) {
  const [bread, setBread] = useState("");
  const [extras, setExtras] = useState("");
  const [sauces, setSauces] = useState("");
  const [price, setPrice] = useState("1.50");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (config) {
      setBread(config.bread_options?.join(", ") || "");
      setExtras(config.extras_options?.join(", ") || "");
      setSauces(config.sauces_options?.join(", ") || "");
      setPrice(String(config.double_meat_price ?? 1.5));
    }
  }, [config, open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        bread_options: bread.split(",").map((s) => s.trim()).filter(Boolean),
        extras_options: extras.split(",").map((s) => s.trim()).filter(Boolean),
        sauces_options: sauces.split(",").map((s) => s.trim()).filter(Boolean),
        double_meat_price: parseFloat(String(price).replace(",", ".")) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, value, onChange, testId, placeholder }) => (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full h-11 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
      />
      <div className="text-xs text-neutral-500 mt-1">Χωρίστε με κόμμα</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0D0D] border-[#333] text-white" data-testid="cust-config-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Επιλογές παραμετροποίησης σάντουιτς</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Row
            label="Τύποι ψωμιού"
            value={bread}
            onChange={setBread}
            testId="cust-bread-input"
            placeholder="Πίτα, Διπλή πίτα, Ψωμάκι"
          />
          <Row
            label="Extras"
            value={extras}
            onChange={setExtras}
            testId="cust-extras-input"
            placeholder="Πατάτα, Ντομάτα..."
          />
          <Row
            label="Σως"
            value={sauces}
            onChange={setSauces}
            testId="cust-sauces-input"
            placeholder="Τζατζίκι, Ρώσικη..."
          />
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Χρέωση διπλής μερίδας κρέατος (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.10"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid="cust-price-input"
              className="w-full h-11 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-[#FF6B00]"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="cust-save-btn"
              className="bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
            >
              <Save className="w-4 h-4 mr-2" /> Αποθήκευση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

  const load = async () => {
    try {
      const c = await apiGetMenuConfig();
      setConfig(c);
      if (!activeCat && c.categories.length) setActiveCat(c.categories[0].id);
    } catch (e) {
      toast.error(formatApiError(e));
    }
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

  const deleteCategory = async (cid) => {
    if (!window.confirm("Διαγραφή κατηγορίας και όλων των προϊόντων της;")) return;
    try {
      await apiDeleteCategory(cid);
      setConfig((p) => ({
        ...p,
        categories: p.categories.filter((c) => c.id !== cid),
        items: p.items.filter((i) => i.category !== cid),
      }));
      if (activeCat === cid) setActiveCat(config.categories[0]?.id || null);
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveItem = async (form) => {
    try {
      const payload = {
        name: form.name,
        price: form.price,
        category: form.category,
        customizable: !!form.customizable,
        double_meat_eligible: !!form.double_meat_eligible,
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

  const deleteItem = async (id) => {
    if (!window.confirm("Διαγραφή προϊόντος;")) return;
    try {
      await apiDeleteItem(id);
      setConfig((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
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

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="flex items-center justify-between px-6 h-16 border-b border-[#333]">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            data-testid="back-to-pda-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">Πίσω στο PDA</span>
          </Link>
          <h1 className="font-heading text-2xl font-bold" data-testid="menu-mgmt-title">
            Διαχείριση Μενού
          </h1>
        </div>
        <Button
          onClick={() => setCustModalOpen(true)}
          data-testid="open-customization-config-btn"
          className="bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white h-11"
        >
          Επιλογές παραμετροποίησης
        </Button>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Categories */}
        <aside className="bg-[#1A1A1A] border border-[#333] rounded-lg p-4">
          <h2 className="font-heading text-lg font-semibold mb-4">Κατηγορίες</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="Νέα κατηγορία"
              data-testid="new-category-input"
              className="flex-1 h-10 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
            />
            <Button
              onClick={addCategory}
              data-testid="add-category-btn"
              className="h-10 bg-[#FF6B00] hover:bg-[#FF8533] px-3"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ul className="space-y-1">
            {config.categories.map((c) => (
              <li key={c.id}>
                {editingCat === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="flex-1 h-9 px-2 bg-[#0D0D0D] border border-[#FF6B00] rounded text-white text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => saveCategoryName(c.id)}
                      className="p-1 text-[#00E676]"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingCat(null)} className="p-1 text-neutral-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group ${
                      activeCat === c.id ? "bg-[#FF6B00]/10 border border-[#FF6B00]" : "hover:bg-[#0D0D0D]"
                    }`}
                    onClick={() => setActiveCat(c.id)}
                    data-testid={`cat-item-${c.id}`}
                  >
                    <span className="font-semibold text-sm">{c.name}</span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCat(c.id);
                          setEditCatName(c.name);
                        }}
                        className="p-1 text-neutral-400 hover:text-white"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(c.id);
                        }}
                        data-testid={`delete-cat-${c.id}`}
                        className="p-1 text-neutral-400 hover:text-[#FF3B30]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Items */}
        <section className="bg-[#1A1A1A] border border-[#333] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold">
              {config.categories.find((c) => c.id === activeCat)?.name || "Προϊόντα"}
            </h2>
            <Button
              onClick={() => {
                setEditingItem(emptyItem(activeCat));
                setItemModalOpen(true);
              }}
              disabled={!activeCat}
              data-testid="add-item-btn"
              className="bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Νέο προϊόν
            </Button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center text-neutral-500 py-12">
              Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredItems.map((it) => (
                <div
                  key={it.id}
                  data-testid={`mgmt-item-${it.id}`}
                  className="p-4 bg-[#0D0D0D] border border-[#333] rounded-lg flex justify-between items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold text-white truncate">{it.name}</div>
                    <div className="font-mono text-[#FF6B00] font-bold mt-1">{eur(it.price)}</div>
                    <div className="flex gap-2 mt-2">
                      {it.customizable && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF6B00]/15 text-[#FF6B00]">
                          Custom
                        </span>
                      )}
                      {it.double_meat_eligible && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                          Διπλό
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    <button
                      onClick={() => {
                        setEditingItem(it);
                        setItemModalOpen(true);
                      }}
                      data-testid={`edit-item-${it.id}`}
                      className="p-2 text-neutral-400 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteItem(it.id)}
                      data-testid={`delete-item-${it.id}`}
                      className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <ItemModal
        open={itemModalOpen}
        initial={editingItem}
        categories={config.categories}
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
    </div>
  );
}
