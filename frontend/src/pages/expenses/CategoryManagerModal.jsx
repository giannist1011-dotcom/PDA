import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------- Category manager modal ----------
export default function CategoryManagerModal({ open, onClose, categories, onCreate, onRename, onDelete }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (open) {
      setNewName("");
      setEditingId(null);
    }
  }, [open]);

  if (!open) return null;

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
  };

  const saveRename = async (cat) => {
    if (editingName.trim() && editingName.trim() !== cat.name) {
      await onRename(cat, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="expense-categories-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-md max-h-[85vh] flex flex-col">
        <h3 className="font-heading text-xl font-bold mb-4">Κατηγορίες εξόδων</h3>

        <form onSubmit={addCategory} className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Νέα κατηγορία..."
            data-testid="expense-new-category-input"
            className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
          />
          <Button
            type="submit"
            data-testid="expense-add-category-btn"
            className="h-11 bg-brand hover:bg-brand-hover px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {categories.map((c) => (
            <div
              key={c.id}
              data-testid={`expense-cat-row-${c.id}`}
              className="flex items-center gap-2 p-3 bg-[#2A0E14] border border-[#723645] rounded-md group"
            >
              {editingId === c.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveRename(c)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(c)}
                  autoFocus
                  className="flex-1 h-9 px-2 bg-[#3D1620] border border-flame rounded text-white text-sm"
                />
              ) : (
                <span className="flex-1 text-sm text-white font-medium">{c.name}</span>
              )}
              <button
                onClick={() => {
                  setEditingId(c.id);
                  setEditingName(c.name);
                }}
                data-testid={`expense-cat-edit-${c.id}`}
                className="p-1.5 text-neutral-400 hover:text-white"
                title="Μετονομασία"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(c)}
                data-testid={`expense-cat-delete-${c.id}`}
                className="p-1.5 text-neutral-400 hover:text-[#FF3B30]"
                title="Διαγραφή"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            data-testid="expense-categories-close-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
}
