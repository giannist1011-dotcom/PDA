import { Plus, Trash2, Pencil, FolderPlus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockRow from "./StockRow";

// ---------- Stock section (κατηγορίες + λίστα ελλείψεων) ----------
export default function StockSection({
  canManage,
  categories,
  items,
  needsCount,
  activeCat,
  setActiveCat,
  setCatModal,
  setItemModal,
  handleDeleteCategory,
  loading,
  filteredItems,
  handleToggleNeed,
  handleDeleteItem,
}) {
  return (
    <section>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-2xl font-bold">Απόθεμα καταστήματος</h2>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Τσεκάρετε ό,τι τελειώνει και προστίθεται αυτόματα στη λίστα αγορών →
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                onClick={() => setCatModal({ open: true, editing: null })}
                data-testid="stock-add-category-btn"
                className="h-10 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Νέα κατηγορία
              </Button>
              <Button
                onClick={() => setItemModal({ open: true })}
                disabled={categories.length === 0}
                data-testid="stock-add-item-btn"
                className="h-10 bg-brand hover:bg-brand-hover"
              >
                <Plus className="w-4 h-4 mr-2" />
                Νέο προϊόν
              </Button>
            </>
          )}
          <div className="text-sm ml-2">
            <span className="text-neutral-400">Στη λίστα: </span>
            <span
              className="font-mono font-bold text-flame"
              data-testid="needs-count"
            >
              {needsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setActiveCat("all")}
          data-testid="stock-filter-all"
          className={`h-10 px-4 rounded-md text-sm font-bold border ${
            activeCat === "all"
              ? "bg-brand border-brand text-white"
              : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
          }`}
        >
          Όλα ({items.length})
        </button>
        <button
          onClick={() => setActiveCat("needs")}
          data-testid="stock-filter-needs"
          className={`h-10 px-4 rounded-md text-sm font-bold border ${
            activeCat === "needs"
              ? "bg-brand border-brand text-white"
              : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
          }`}
        >
          Στη λίστα ({needsCount})
        </button>
        {categories.map((c) => {
          const count = items.filter((i) => i.category_id === c.id).length;
          const active = activeCat === c.id;
          return (
            <div key={c.id} className="flex items-center gap-1 group">
              <button
                onClick={() => setActiveCat(c.id)}
                data-testid={`stock-filter-${c.id}`}
                className={`h-10 px-4 rounded-md text-sm font-bold border ${
                  active
                    ? "bg-brand border-brand text-white"
                    : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                }`}
              >
                {c.name} ({count})
              </button>
              {canManage && (
                <div className="flex [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => setCatModal({ open: true, editing: c })}
                    data-testid={`stock-cat-edit-${c.id}`}
                    className="p-1.5 text-neutral-400 hover:text-white"
                    title="Μετονομασία"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c)}
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

      {loading ? (
        <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
      ) : categories.length === 0 ? (
        <div className="text-neutral-500 py-12 text-center border border-dashed border-[#723645] rounded-lg">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <div className="mb-2">Δεν έχετε δημιουργήσει κατηγορίες αποθέματος</div>
          {canManage && (
            <button
              onClick={() => setCatModal({ open: true, editing: null })}
              className="text-flame font-bold hover:underline"
              data-testid="stock-empty-add-category"
            >
              Δημιουργήστε την πρώτη κατηγορία
            </button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-neutral-500 py-12 text-center">
          Δεν υπάρχουν προϊόντα σε αυτή την προβολή
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((it) => (
            <StockRow
              key={it.id}
              item={it}
              onToggleNeed={handleToggleNeed}
              onDelete={handleDeleteItem}
              canEdit={canManage}
            />
          ))}
        </div>
      )}
    </section>
  );
}
