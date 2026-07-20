import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatApiError } from "@/lib/api";
import { emptyItem } from "./utils";
import ItemPhotoPicker from "./ItemPhotoPicker";
import OptionGroupsEditor from "./OptionGroupsEditor";

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
export default function ItemModal({
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
        allergens: (form.allergens || "").trim(),
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

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Αλλεργιογόνα / Σύσταση (προαιρετικό)
            </label>
            <input
              value={form.allergens || ""}
              onChange={(e) => setForm({ ...form, allergens: e.target.value })}
              maxLength={200}
              placeholder="π.χ. γλουτένη, γάλα, ξηροί καρποί"
              data-testid="item-allergens-input"
              className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Εμφανίζεται μόνο στον δημόσιο κατάλογο — όχι στο ταμείο (PDA)
            </p>
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
          <OptionGroupsEditor
            form={form}
            addGroup={addGroup}
            updateGroup={updateGroup}
            removeGroup={removeGroup}
            addOption={addOption}
            removeOption={removeOption}
            updateOption={updateOption}
          />

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
          <ItemPhotoPicker
            setPhotoPickerOpen={setPhotoPickerOpen}
            pickerTab={pickerTab}
            setPickerTab={setPickerTab}
            photos={photos}
            stockPhotos={stockPhotos}
            form={form}
            setForm={setForm}
            pickStock={pickStock}
            importingId={importingId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
