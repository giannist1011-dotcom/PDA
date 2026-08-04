import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import VariantsEditor from "./VariantsEditor";

// ---------- Είδος ελλείψεων: όνομα + κατηγορία + προαιρετικές παραλλαγές ----------
export default function AddItemModal({
  open,
  onClose,
  categories,
  defaultCategoryId,
  editing = null,
  onSubmit,
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    if (open) {
      setName(editing?.name || "");
      setCategoryId(editing?.category_id || defaultCategoryId || (categories[0]?.id ?? ""));
      setVariants(editing?.variants || []);
    }
  }, [open, editing, defaultCategoryId, categories]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    await onSubmit({
      name: name.trim(),
      category_id: categoryId,
      variants: variants
        .map((v) => ({ ...v, name: (v.name || "").trim() }))
        .filter((v) => v.name),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="stock-item-modal"
    >
      <form
        onSubmit={submit}
        className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <h3 className="font-heading text-xl font-bold mb-4">
          {editing ? "Επεξεργασία είδους" : "Νέο είδος ελλείψεων"}
        </h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Σακούλες"
          data-testid="stock-item-name-input"
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <label className="text-xs uppercase tracking-wider text-neutral-400">Κατηγορία</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="stock-item-category-select"
          className="w-full h-11 mt-1 mb-5 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <VariantsEditor value={variants} onChange={setVariants} />
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-item-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            data-testid="stock-item-save-btn"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            {editing ? "Αποθήκευση" : "Προσθήκη"}
          </Button>
        </div>
      </form>
    </div>
  );
}
