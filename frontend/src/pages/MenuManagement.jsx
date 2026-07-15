import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  CheckSquare,
  Square,
  ImageOff,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import BulkActionsBar from "@/components/BulkActionsBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  apiReorderCategories,
  apiReorderItems,
  apiListPhotos,
  apiListStockPhotos,
  apiImportStockPhoto,
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
  option_groups: [],
  photo_id: null,
});

const shortId = () =>
  Math.random().toString(36).slice(2, 8);

const emptyGroup = () => ({
  id: shortId(),
  name: "",
  type: "single",
  required: false,
  price_mode: "add",
  options: [{ name: "", price: 0 }],
});

// ---------- Item Modal ----------
function ItemModal({
  open,
  initial,
  categories,
  photos = [],
  stockPhotos = [],
  onImportStock,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(initial || emptyItem());
  const [busy, setBusy] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("mine"); // "mine" | "stock"
  const [importingId, setImportingId] = useState(null);

  useEffect(() => {
    const base = initial || emptyItem(categories[0]?.id || "");
    setForm({
      ...base,
      option_groups: base.option_groups || [],
      photo_id: base.photo_id || null,
    });
  }, [initial, open, categories]);

  // Ξεκίνα πάντα στο σωστό tab: αν δεν έχει προσωπικές αλλά έχει βιβλιοθήκη
  useEffect(() => {
    if (photoPickerOpen) {
      setPickerTab(photos.length === 0 && stockPhotos.length > 0 ? "stock" : "mine");
    }
  }, [photoPickerOpen, photos.length, stockPhotos.length]);

  const selectedPhoto = photos.find((p) => p.id === form.photo_id);

  const pickStock = async (sp) => {
    if (importingId) return;
    setImportingId(sp.id);
    try {
      const personal = await onImportStock(sp.id);
      if (personal?.id) {
        setForm((f) => ({ ...f, photo_id: personal.id }));
        setPhotoPickerOpen(false);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setImportingId(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Sanitize option_groups: remove empty option rows and empty groups
      const cleanGroups = (form.option_groups || [])
        .map((g) => ({
          id: g.id || shortId(),
          name: (g.name || "").trim(),
          type: g.type === "multi" ? "multi" : "single",
          required: !!g.required,
          price_mode: g.price_mode === "replace" ? "replace" : "add",
          options: (g.options || [])
            .map((o) => ({
              name: (o.name || "").trim(),
              price: parseFloat(String(o.price).replace(",", ".")) || 0,
            }))
            .filter((o) => o.name),
        }))
        .filter((g) => g.name && g.options.length > 0);

      await onSave({
        ...form,
        price: parseFloat(String(form.price).replace(",", ".")) || 0,
        option_groups: cleanGroups,
        photo_id: form.photo_id || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const addGroup = () =>
    setForm((f) => ({ ...f, option_groups: [...(f.option_groups || []), emptyGroup()] }));
  const removeGroup = (idx) =>
    setForm((f) => ({
      ...f,
      option_groups: f.option_groups.filter((_, i) => i !== idx),
    }));
  const updateGroup = (idx, patch) =>
    setForm((f) => ({
      ...f,
      option_groups: f.option_groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }));
  const addOption = (gi) =>
    setForm((f) => ({
      ...f,
      option_groups: f.option_groups.map((g, i) =>
        i === gi ? { ...g, options: [...g.options, { name: "", price: 0 }] } : g
      ),
    }));
  const removeOption = (gi, oi) =>
    setForm((f) => ({
      ...f,
      option_groups: f.option_groups.map((g, i) =>
        i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g
      ),
    }));
  const updateOption = (gi, oi, patch) =>
    setForm((f) => ({
      ...f,
      option_groups: f.option_groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
            }
          : g
      ),
    }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#2A0E14] border-[#723645] text-white" data-testid="item-modal">
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
              className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
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
                className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white font-mono focus:outline-none focus:border-flame"
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
                className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#3D1620] border border-[#723645] rounded-md">
            <div className="flex items-center gap-3 min-w-0">
              {selectedPhoto ? (
                <img
                  src={selectedPhoto.data_url}
                  alt=""
                  className="w-14 h-14 rounded-md object-cover shrink-0 border border-[#723645]"
                />
              ) : (
                <div className="w-14 h-14 rounded-md bg-[#2A0E14] border border-dashed border-[#723645] flex items-center justify-center shrink-0">
                  <ImageOff className="w-5 h-5 text-neutral-600" />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-sm">Φωτογραφία προϊόντος</div>
                <div className="text-xs text-neutral-500 truncate">
                  {selectedPhoto ? selectedPhoto.filename : "Καμία επιλογή"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {form.photo_id && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, photo_id: null })}
                  data-testid="item-photo-clear"
                  className="text-xs text-neutral-400 hover:text-[#FF3B30] px-2 py-1"
                >
                  Αφαίρεση
                </button>
              )}
              <Button
                type="button"
                onClick={() => setPhotoPickerOpen(true)}
                data-testid="item-photo-pick-btn"
                disabled={photos.length === 0 && stockPhotos.length === 0}
                className="h-9 bg-[#2A0E14] border border-[#723645] hover:border-flame text-white text-xs"
                title={
                  photos.length === 0 && stockPhotos.length === 0
                    ? "Ανεβάστε πρώτα φωτογραφίες"
                    : "Επιλογή"
                }
              >
                {form.photo_id ? "Αλλαγή" : "Επιλογή"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-[#3D1620] border border-[#723645] rounded-md">
            <div>
              <div className="font-semibold text-sm">Παραμετροποιήσιμο (σάντουιτς)</div>
              <div className="text-xs text-neutral-500">Χρησιμοποιεί επιλογές ψωμί/extras/σως</div>
            </div>
            <Switch
              checked={form.customizable}
              onCheckedChange={(v) => setForm({ ...form, customizable: !!v })}
              data-testid="item-customizable-switch"
            />
          </div>
          {form.customizable && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#3D1620] border border-[#723645] rounded-md">
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

          {/* Option groups editor */}
          <div className="border-t border-[#431A25] pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-heading font-bold text-sm">Ομάδες επιλογών</div>
                <div className="text-xs text-neutral-500">
                  Π.χ. Μέγεθος, Έξτρα υλικά. Δουλεύουν σε οποιοδήποτε προϊόν.
                </div>
              </div>
              <Button
                type="button"
                onClick={addGroup}
                data-testid="add-option-group-btn"
                className="h-9 bg-[#3D1620] border border-[#723645] hover:border-flame text-white text-sm"
              >
                <Plus className="w-4 h-4 mr-1" /> Ομάδα
              </Button>
            </div>

            {(form.option_groups || []).map((g, gi) => (
              <div
                key={g.id}
                data-testid={`option-group-${gi}`}
                className="mt-3 p-3 bg-[#3D1620] border border-[#723645] rounded-md space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="Όνομα ομάδας (π.χ. Μέγεθος)"
                    data-testid={`group-name-${gi}`}
                    className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                  />
                  <select
                    value={g.type}
                    onChange={(e) => updateGroup(gi, { type: e.target.value })}
                    data-testid={`group-type-${gi}`}
                    className="h-10 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none"
                  >
                    <option value="single">Μία</option>
                    <option value="multi">Πολλές</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={!!g.required}
                      onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                      data-testid={`group-required-${gi}`}
                    />
                    Υποχρ.
                  </label>
                  <button
                    type="button"
                    onClick={() => removeGroup(gi)}
                    data-testid={`remove-group-${gi}`}
                    className="p-2 text-neutral-500 hover:text-[#FF3B30]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 shrink-0">
                    Τύπος τιμής
                  </label>
                  <select
                    value={g.price_mode || "add"}
                    onChange={(e) => updateGroup(gi, { price_mode: e.target.value })}
                    data-testid={`group-price-mode-${gi}`}
                    className="flex-1 h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-xs focus:outline-none focus:border-flame"
                  >
                    <option value="add">Προσαύξηση (+€ πάνω στη βάση)</option>
                    <option value="replace">Καθορισμός τιμής (αντικαθιστά τη βασική)</option>
                  </select>
                </div>
                {g.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      value={o.name}
                      onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                      placeholder="Επιλογή"
                      data-testid={`option-name-${gi}-${oi}`}
                      className="flex-1 h-9 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                    />
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={o.price}
                      onChange={(e) => updateOption(gi, oi, { price: e.target.value })}
                      placeholder="+€"
                      data-testid={`option-price-${gi}-${oi}`}
                      className="w-24 h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm font-mono focus:outline-none focus:border-flame"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(gi, oi)}
                      data-testid={`remove-option-${gi}-${oi}`}
                      className="p-1 text-neutral-500 hover:text-[#FF3B30]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => addOption(gi)}
                  data-testid={`add-option-${gi}`}
                  className="h-8 bg-transparent border border-dashed border-[#6B3345] hover:border-flame text-neutral-400 hover:text-white text-xs w-full"
                >
                  <Plus className="w-3 h-3 mr-1" /> Προσθήκη επιλογής
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="item-save-btn"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              <Save className="w-4 h-4 mr-2" /> Αποθήκευση
            </Button>
          </DialogFooter>
        </form>

        {/* Photo picker overlay (inline modal on top) */}
        {photoPickerOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
            data-testid="item-photo-picker"
          >
            <div className="bg-[#2A0E14] border border-[#723645] rounded-lg p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-xl font-bold">Επιλογή φωτογραφίας</h3>
                <button
                  onClick={() => setPhotoPickerOpen(false)}
                  data-testid="item-photo-picker-close"
                  className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs: προσωπικές vs κοινή βιβλιοθήκη OrderDeck */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPickerTab("mine")}
                  data-testid="item-photo-tab-mine"
                  className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
                    pickerTab === "mine"
                      ? "bg-brand border-brand text-white"
                      : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                  }`}
                >
                  Οι φωτογραφίες μου ({photos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab("stock")}
                  data-testid="item-photo-tab-stock"
                  className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
                    pickerTab === "stock"
                      ? "bg-brand border-brand text-white"
                      : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                  }`}
                >
                  Βιβλιοθήκη OrderDeck ({stockPhotos.length})
                </button>
              </div>

              {pickerTab === "mine" ? (
                photos.length === 0 ? (
                  <div className="text-neutral-500 py-12 text-center">
                    Δεν υπάρχουν προσωπικές φωτογραφίες. Ανεβάστε από «Βιβλιοθήκη φωτογραφιών» ή
                    διαλέξτε από τη Βιβλιοθήκη OrderDeck.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {photos.map((p) => {
                      const active = p.id === form.photo_id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, photo_id: p.id });
                            setPhotoPickerOpen(false);
                          }}
                          data-testid={`item-photo-option-${p.id}`}
                          className={`rounded-lg overflow-hidden border-2 transition-colors ${
                            active
                              ? "border-flame ring-2 ring-flame/40"
                              : "border-[#723645] hover:border-flame"
                          }`}
                        >
                          <img
                            src={p.data_url}
                            alt={p.filename}
                            className="w-full aspect-square object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : stockPhotos.length === 0 ? (
                <div className="text-neutral-500 py-12 text-center">
                  Δεν υπάρχουν ακόμα φωτογραφίες OrderDeck για τον τύπο του καταστήματός σας.
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {stockPhotos.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => pickStock(sp)}
                      disabled={!!importingId}
                      data-testid={`item-photo-stock-${sp.id}`}
                      className="rounded-lg overflow-hidden border-2 border-[#723645] hover:border-flame transition-colors disabled:opacity-50 text-left"
                    >
                      <div className="relative">
                        <img
                          src={sp.data_url}
                          alt={sp.product_label}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                        {importingId === sp.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold">
                            Προσθήκη...
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5 text-xs text-neutral-300 truncate" title={sp.product_label}>
                        {sp.product_label}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Customization Modal ----------
// Options may be stored as plain strings (legacy) or {name, price} dicts.
const toPricedOption = (x) =>
  typeof x === "string"
    ? { name: x, price: 0 }
    : { name: x?.name || "", price: Number(x?.price || 0) };

function PricedOptionList({ label, hint, rows, setRows, testPrefix }) {
  const update = (idx, patch) =>
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((p) => p.filter((_, i) => i !== idx));
  const add = () => setRows((p) => [...p, { name: "", price: "" }]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          {label}
        </label>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Όνομα επιλογής"
              data-testid={`${testPrefix}-name-${i}`}
              className="flex-1 h-10 px-3 bg-[#3D1620] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            />
            <input
              type="number"
              min="0"
              step="0.10"
              value={r.price}
              onChange={(e) => update(i, { price: e.target.value })}
              placeholder="+€"
              title="Επιπλέον χρέωση (0 = δωρεάν)"
              data-testid={`${testPrefix}-price-${i}`}
              className="w-24 h-10 px-2 bg-[#3D1620] border border-[#723645] rounded-md text-white text-sm font-mono focus:outline-none focus:border-flame"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              data-testid={`${testPrefix}-remove-${i}`}
              className="p-1.5 text-neutral-500 hover:text-[#FF3B30]"
              title="Αφαίρεση"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          onClick={add}
          data-testid={`${testPrefix}-add`}
          className="h-9 bg-transparent border border-dashed border-[#6B3345] hover:border-flame text-neutral-400 hover:text-white text-xs w-full"
        >
          <Plus className="w-3 h-3 mr-1" /> Προσθήκη επιλογής
        </Button>
      </div>
    </div>
  );
}

function CustomizationConfigModal({ open, config, onClose, onSave }) {
  const [bread, setBread] = useState([]);
  const [extras, setExtras] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [price, setPrice] = useState("1.50");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && config) {
      setBread((config.bread_options || []).map(toPricedOption));
      setExtras((config.extras_options || []).map(toPricedOption));
      setSauces((config.sauces_options || []).map(toPricedOption));
      setPrice(String(config.double_meat_price ?? 1.5));
    }
  }, [config, open]);

  const cleanRows = (rows) =>
    rows
      .map((r) => ({
        name: (r.name || "").trim(),
        price: parseFloat(String(r.price).replace(",", ".")) || 0,
      }))
      .filter((r) => r.name);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        bread_options: cleanRows(bread),
        extras_options: cleanRows(extras),
        sauces_options: cleanRows(sauces),
        double_meat_price: parseFloat(String(price).replace(",", ".")) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#2A0E14] border-[#723645] text-white"
        data-testid="cust-config-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Επιλογές παραμετροποίησης σάντουιτς
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            Ορίστε τις διαθέσιμες επιλογές και την επιπλέον χρέωση καθεμιάς (0 = δωρεάν)
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <PricedOptionList
            label="Τύποι ψωμιού"
            hint="μία επιλογή ανά σάντουιτς"
            rows={bread}
            setRows={setBread}
            testPrefix="cust-bread"
          />
          <PricedOptionList
            label="Υλικά"
            hint="πολλαπλές επιλογές"
            rows={extras}
            setRows={setExtras}
            testPrefix="cust-extras"
          />
          <PricedOptionList
            label="Αλοιφές"
            hint="πολλαπλές επιλογές"
            rows={sauces}
            setRows={setSauces}
            testPrefix="cust-sauces"
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
              className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white font-mono focus:outline-none focus:border-flame"
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
              className="bg-brand hover:bg-brand-hover font-bold"
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
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-[#431A25]">
        <Button
          onClick={() => (editMode ? exitEdit() : setEditMode(true))}
          data-testid="toggle-edit-mode-btn"
          className={`h-11 ${
            editMode
              ? "bg-brand hover:bg-brand-hover text-white"
              : "bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
          }`}
        >
          {editMode ? (
            <>
              <X className="w-4 h-4 mr-2" /> Τέλος
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4 mr-2" /> Επεξεργασία
            </>
          )}
        </Button>
        <Button
          onClick={() => setCustModalOpen(true)}
          data-testid="open-customization-config-btn"
          className="bg-[#3D1620] border border-[#723645] hover:border-flame text-white h-11"
        >
          Επιλογές παραμετροποίησης
        </Button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 md:gap-6">
        {/* Categories */}
        <aside className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
          <h2 className="font-heading text-lg font-semibold mb-4">Κατηγορίες</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="Νέα κατηγορία"
              data-testid="new-category-input"
              className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            />
            <Button
              onClick={addCategory}
              data-testid="add-category-btn"
              className="h-10 bg-brand hover:bg-brand-hover px-3"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ul className="space-y-1">
            {config.categories.map((c, ci) => (
              <li key={c.id}>
                {editingCat === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="flex-1 h-9 px-2 bg-[#2A0E14] border border-flame rounded text-white text-sm"
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
                      activeCat === c.id ? "bg-flame/10 border border-flame" : "hover:bg-[#2A0E14]"
                    } ${dragCatId === c.id ? "opacity-40" : ""}`}
                    onClick={() => setActiveCat(c.id)}
                    draggable={editMode}
                    onDragStart={(e) => {
                      if (!editMode) return;
                      setDragCatId(c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => editMode && e.preventDefault()}
                    onDrop={(e) => {
                      if (!editMode) return;
                      e.preventDefault();
                      dropCategory(c.id);
                      setDragCatId(null);
                    }}
                    onDragEnd={() => setDragCatId(null)}
                    data-testid={`cat-item-${c.id}`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {editMode && (
                        <GripVertical className="w-4 h-4 text-neutral-500 shrink-0 cursor-grab touch-none" />
                      )}
                      <span className="font-semibold text-sm truncate">{c.name}</span>
                    </span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {editMode && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCategory(ci, -1);
                            }}
                            disabled={ci === 0}
                            data-testid={`cat-up-${c.id}`}
                            className="p-2 -my-1 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400"
                            title="Πάνω"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCategory(ci, 1);
                            }}
                            disabled={ci === config.categories.length - 1}
                            data-testid={`cat-down-${c.id}`}
                            className="p-2 -my-1 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400"
                            title="Κάτω"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
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
                          deleteCategory(c);
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
        <section className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold">
              {config.categories.find((c) => c.id === activeCat)?.name || "Προϊόντα"}
            </h2>
            <Button
              onClick={() => {
                setEditingItem(emptyItem(activeCat));
                setItemModalOpen(true);
              }}
              disabled={!activeCat || editMode}
              data-testid="add-item-btn"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Νέο προϊόν
            </Button>
          </div>

          {editMode && filteredItems.length > 0 && (
            <div className="mb-3">
              <button
                onClick={toggleSelectAll}
                data-testid="select-all-btn"
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-bold border transition-colors ${
                  allSelected
                    ? "bg-flame/15 border-flame text-flame"
                    : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                }`}
              >
                {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allSelected ? "Αποεπιλογή όλων" : "Επιλογή όλων της κατηγορίας"}
              </button>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center text-neutral-500 py-12">
              Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredItems.map((it, ii) => {
                const checked = selectedIds.includes(it.id);
                return (
                <div
                  key={it.id}
                  data-testid={`mgmt-item-${it.id}`}
                  onClick={() => editMode && toggleSelect(it.id)}
                  draggable={editMode}
                  onDragStart={(e) => {
                    if (!editMode) return;
                    setDragItemId(it.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => editMode && e.preventDefault()}
                  onDrop={(e) => {
                    if (!editMode) return;
                    e.preventDefault();
                    dropItem(it.id);
                    setDragItemId(null);
                  }}
                  onDragEnd={() => setDragItemId(null)}
                  className={`p-4 bg-[#2A0E14] border rounded-lg flex justify-between items-start transition-colors ${
                    editMode ? "cursor-pointer" : ""
                  } ${dragItemId === it.id ? "opacity-40" : ""} ${
                    checked
                      ? "border-flame bg-flame/5"
                      : "border-[#723645] hover:border-[#6B3345]"
                  }`}
                >
                  {editMode && (
                    <div className="flex flex-col items-center gap-2 mr-3 shrink-0">
                      <div
                        className={`w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center ${
                          checked ? "bg-brand border-brand" : "border-[#7A3E52]"
                        }`}
                        data-testid={`select-item-${it.id}`}
                      >
                        {checked && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>
                      <GripVertical className="w-5 h-5 text-neutral-500 cursor-grab touch-none" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold text-white truncate">{it.name}</div>
                    <div className="font-mono text-gold font-bold mt-1">{eur(it.price)}</div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {it.customizable && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-flame/15 text-flame">
                          Custom
                        </span>
                      )}
                      {it.double_meat_eligible && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                          Διπλό
                        </span>
                      )}
                      {(it.option_groups || []).length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#00B0FF]/15 text-[#00B0FF]">
                          {it.option_groups.length} ομ.
                        </span>
                      )}
                      {it.available === false && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/15 text-[#FF6961]">
                          Έλλειψη
                        </span>
                      )}
                    </div>
                  </div>
                  {editMode ? (
                    <div className="flex flex-col gap-1 ml-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(ii, -1);
                        }}
                        disabled={ii === 0}
                        data-testid={`item-up-${it.id}`}
                        className="p-2.5 rounded-md border border-[#723645] text-neutral-300 hover:text-white hover:border-flame disabled:opacity-30 disabled:hover:text-neutral-300 disabled:hover:border-[#723645]"
                        title="Πάνω"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(ii, 1);
                        }}
                        disabled={ii === filteredItems.length - 1}
                        data-testid={`item-down-${it.id}`}
                        className="p-2.5 rounded-md border border-[#723645] text-neutral-300 hover:text-white hover:border-flame disabled:opacity-30 disabled:hover:text-neutral-300 disabled:hover:border-[#723645]"
                        title="Κάτω"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 ml-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(it);
                          setItemModalOpen(true);
                        }}
                        data-testid={`edit-item-${it.id}`}
                        className="p-2 text-neutral-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmItem(it);
                        }}
                        data-testid={`delete-item-${it.id}`}
                        className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </section>
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

      <AlertDialog open={!!confirmItem} onOpenChange={(v) => !v && setConfirmItem(null)}>
        <AlertDialogContent className="bg-[#2A0E14] border-[#723645] text-white" data-testid="delete-item-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl">Διαγραφή προϊόντος;</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Θα διαγραφεί οριστικά το «{confirmItem?.name}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-item-cancel"
              className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
            >
              Άκυρο
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteItem}
              data-testid="delete-item-confirm"
              className="bg-[#FF3B30] hover:bg-[#FF5A50] text-white"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCat} onOpenChange={(v) => !v && setConfirmCat(null)}>
        <AlertDialogContent className="bg-[#2A0E14] border-[#723645] text-white" data-testid="delete-cat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl">Διαγραφή κατηγορίας;</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Θα διαγραφεί η «{confirmCat?.name}» μαζί με όλα τα προϊόντα της.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-cat-cancel"
              className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
            >
              Άκυρο
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              data-testid="delete-cat-confirm"
              className="bg-[#FF3B30] hover:bg-[#FF5A50] text-white"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
