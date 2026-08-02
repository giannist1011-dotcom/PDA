import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

// ---------- Ράγα κατηγοριών ελλείψεων (φίλτρο + διαχείριση σε edit mode) ----------
export default function CategoryRail({
  categories,
  items,
  itemsCount,
  needsCount,
  activeCat,
  setActiveCat,
  canManage,
  editMode,
  onEditCategory,
  onDeleteCategory,
  onMoveCategory,
}) {
  const chip = (active) =>
    `h-10 px-4 rounded-md text-sm font-bold border ${
      active
        ? "bg-brand border-brand text-white"
        : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
    }`;
  const iconBtn =
    "p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400";

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <button
        onClick={() => setActiveCat("all")}
        data-testid="stock-filter-all"
        className={chip(activeCat === "all")}
      >
        Όλα ({itemsCount})
      </button>
      <button
        onClick={() => setActiveCat("needs")}
        data-testid="stock-filter-needs"
        className={chip(activeCat === "needs")}
      >
        Στη λίστα ({needsCount})
      </button>
      {categories.map((c, ci) => {
        const count = items.filter((i) => i.category_id === c.id).length;
        return (
          <div key={c.id} className="flex items-center gap-1 group">
            <button
              onClick={() => setActiveCat(c.id)}
              data-testid={`stock-filter-${c.id}`}
              className={chip(activeCat === c.id)}
            >
              {c.name} ({count})
            </button>
            {canManage && editMode && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onMoveCategory(ci, -1)}
                  disabled={ci === 0}
                  data-testid={`stock-cat-left-${c.id}`}
                  className={iconBtn}
                  title="Πιο μπροστά"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onMoveCategory(ci, 1)}
                  disabled={ci === categories.length - 1}
                  data-testid={`stock-cat-right-${c.id}`}
                  className={iconBtn}
                  title="Πιο πίσω"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEditCategory(c)}
                  data-testid={`stock-cat-edit-${c.id}`}
                  className={iconBtn}
                  title="Μετονομασία"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteCategory(c)}
                  data-testid={`stock-cat-delete-${c.id}`}
                  className="p-1.5 text-neutral-400 hover:text-[#FF3B30]"
                  title="Διαγραφή"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
