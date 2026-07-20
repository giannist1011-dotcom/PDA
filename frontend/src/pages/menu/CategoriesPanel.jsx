import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CategoriesPanel({
  config,
  newCatName,
  setNewCatName,
  addCategory,
  editingCat,
  setEditingCat,
  editCatName,
  setEditCatName,
  saveCategoryName,
  deleteCategory,
  activeCat,
  setActiveCat,
  editMode,
  dragCatId,
  setDragCatId,
  dropCategory,
  moveCategory,
}) {
  return (
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
  );
}
