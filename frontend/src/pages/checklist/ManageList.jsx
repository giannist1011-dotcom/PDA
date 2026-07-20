import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiChecklistCreateTemplate,
  apiChecklistUpdateTemplate,
  apiChecklistDeleteTemplate,
  apiChecklistReorder,
} from "@/lib/api";
import { LIST_META } from "./utils";

// ---------- Διαχείριση (owner) ----------
export default function ManageList({ list, items, onChanged }) {
  const meta = LIST_META[list];
  const Icon = meta.icon;
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const text = newText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await apiChecklistCreateTemplate(list, text);
      setNewText("");
      await onChanged();
    } catch {
      toast.error("Σφάλμα προσθήκης");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await apiChecklistUpdateTemplate(editId, text);
      setEditId(null);
      await onChanged();
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it) => {
    if (!window.confirm(`Διαγραφή «${it.text}»;`)) return;
    setBusy(true);
    try {
      await apiChecklistDeleteTemplate(it.id);
      await onChanged();
    } catch {
      toast.error("Σφάλμα διαγραφής");
    } finally {
      setBusy(false);
    }
  };

  const move = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length || busy) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setBusy(true);
    try {
      await apiChecklistReorder(list, ids);
      await onChanged();
    } catch {
      toast.error("Σφάλμα αναδιάταξης");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#723645] font-heading font-semibold text-lg">
        <Icon className={`w-5 h-5 ${meta.color}`} />
        {meta.label}
      </div>
      <div className="divide-y divide-[#431A25]">
        {items.map((it, idx) => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-2.5">
            {editId === it.id ? (
              <>
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                  className="flex-1 min-w-0 h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-white focus:border-flame outline-none"
                  data-testid={`checklist-edit-input-${it.id}`}
                />
                <button
                  onClick={saveEdit}
                  data-testid={`checklist-edit-save-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md bg-[#00E676]/15 text-[#00E676] flex items-center justify-center"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-400 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || busy}
                    aria-label="Πάνω"
                    className="w-8 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1 || busy}
                    aria-label="Κάτω"
                    className="w-8 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <span className="flex-1 min-w-0 text-white font-semibold truncate">
                  {it.text}
                </span>
                <button
                  onClick={() => {
                    setEditId(it.id);
                    setEditText(it.text);
                  }}
                  data-testid={`checklist-edit-btn-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-300 hover:border-flame flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(it)}
                  data-testid={`checklist-delete-btn-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-300 hover:border-[#FF3B30] hover:text-[#FF3B30] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-[#723645]">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Νέα εργασία (π.χ. Άναψε τη σχάρα)"
          data-testid={`checklist-add-input-${list}`}
          className="flex-1 min-w-0 h-11 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-white placeholder-neutral-600 focus:border-flame outline-none"
        />
        <button
          onClick={add}
          disabled={!newText.trim() || busy}
          data-testid={`checklist-add-btn-${list}`}
          className="h-11 px-4 shrink-0 rounded-md bg-flame text-white font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Προσθήκη</span>
        </button>
      </div>
    </div>
  );
}
