import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// ---------- Add / rename category modal ----------
export default function CategoryModal({ open, onClose, onSubmit, initialName = "", title }) {
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
        className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">{title}</h3>
        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα κατηγορίας</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Καθαριστικά"
          data-testid="stock-category-name-input"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-category-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
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
