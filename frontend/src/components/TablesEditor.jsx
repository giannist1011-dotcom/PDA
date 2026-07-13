import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiCreateTable,
  apiUpdateTable,
  apiDeleteTable,
  apiReorderTables,
  formatApiError,
} from "@/lib/api";

// tables: [{id, name, order, tab}] — onChange(newTables) keeps the parent in sync.
export default function TablesEditor({ tables, onChange }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const add = async (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await apiCreateTable(newName.trim());
      onChange([...tables, { ...created, tab: null }]);
      setNewName("");
      toast.success("Το τραπέζι προστέθηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const saveRename = async (t) => {
    const name = editingName.trim();
    setEditingId(null);
    if (!name || name === t.name) return;
    try {
      await apiUpdateTable(t.id, { name, order: t.order || 0 });
      onChange(tables.map((x) => (x.id === t.id ? { ...x, name } : x)));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Διαγραφή τραπεζιού "${t.name}";`)) return;
    try {
      await apiDeleteTable(t.id);
      onChange(tables.filter((x) => x.id !== t.id));
      toast.success("Διαγράφηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const move = async (idx, delta) => {
    const to = idx + delta;
    if (to < 0 || to >= tables.length) return;
    const next = [...tables];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
    try {
      await apiReorderTables(next.map((t) => t.id));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder='π.χ. "Τ1" ή "Μπαλκόνι 2"'
          data-testid="table-new-name-input"
          className="flex-1 h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />
        <Button
          type="submit"
          data-testid="table-add-btn"
          className="h-11 bg-brand hover:bg-brand-hover px-4"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </form>

      {tables.length === 0 ? (
        <div className="text-neutral-500 text-sm py-6 text-center border border-dashed border-[#333] rounded-lg">
          Δεν έχετε ορίσει τραπέζια ακόμα
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tables.map((t, idx) => (
            <li
              key={t.id}
              data-testid={`table-editor-row-${t.id}`}
              className="flex items-center gap-1.5 p-2 bg-[#0D0D0D] border border-[#333] rounded-md"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  data-testid={`table-up-${t.id}`}
                  className="p-1 text-neutral-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === tables.length - 1}
                  data-testid={`table-down-${t.id}`}
                  className="p-1 text-neutral-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingId === t.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveRename(t)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(t)}
                  autoFocus
                  className="flex-1 h-9 px-2 bg-[#1A1A1A] border border-flame rounded text-white text-sm"
                />
              ) : (
                <span className="flex-1 text-white font-semibold text-sm truncate">
                  {t.name}
                  {t.tab && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-flame">
                      Ανοιχτό
                    </span>
                  )}
                </span>
              )}
              <button
                onClick={() =>
                  editingId === t.id
                    ? saveRename(t)
                    : (setEditingId(t.id), setEditingName(t.name))
                }
                data-testid={`table-rename-${t.id}`}
                className="p-2 text-neutral-400 hover:text-white"
                title="Μετονομασία"
              >
                {editingId === t.id ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
              <button
                onClick={() => remove(t)}
                disabled={!!t.tab}
                data-testid={`table-delete-${t.id}`}
                className="p-2 text-neutral-400 hover:text-[#FF3B30] disabled:opacity-30"
                title={t.tab ? "Έχει ανοιχτή καρτέλα" : "Διαγραφή"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
