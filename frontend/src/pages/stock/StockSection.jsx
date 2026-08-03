import { Plus, FolderPlus, Package, Pencil, Check as CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockRow from "./StockRow";
import CategoryRail from "./CategoryRail";

// ---------- Ελλείψεις: κατηγορίες με είδη από κάτω (όπως ο κατάλογος) ----------
export default function StockSection({
  canManage,
  categories,
  items,
  needsCount,
  activeCat,
  setActiveCat,
  editMode,
  setEditMode,
  setCatModal,
  setItemModal,
  handleDeleteCategory,
  handleMoveCategory,
  handleMoveItem,
  loading,
  groups,
  handleToggleNeed,
  handleToggleCategoryNeeds,
  handleDeleteItem,
}) {
  return (
    <section>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-2xl font-bold">Ελλείψεις καταστήματος</h2>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Κατηγορίες με είδη από κάτω — τσεκάρετε ό,τι τελειώνει και μπαίνει στη λίστα →
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                onClick={() => setEditMode((v) => !v)}
                data-testid="stock-edit-mode-btn"
                className={`h-10 border ${
                  editMode
                    ? "bg-flame/15 border-flame text-flame hover:bg-flame/25"
                    : "bg-[#3D1620] border-[#723645] hover:border-flame text-white"
                }`}
              >
                {editMode ? (
                  <CheckIcon className="w-4 h-4 mr-2" />
                ) : (
                  <Pencil className="w-4 h-4 mr-2" />
                )}
                {editMode ? "Τέλος" : "Επεξεργασία"}
              </Button>
              <Button
                onClick={() => setCatModal({ open: true, editing: null })}
                data-testid="stock-add-category-btn"
                className="h-10 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Νέα κατηγορία
              </Button>
              <Button
                onClick={() => setItemModal({ open: true, editing: null })}
                disabled={categories.length === 0}
                data-testid="stock-add-item-btn"
                className="h-10 bg-brand hover:bg-brand-hover"
              >
                <Plus className="w-4 h-4 mr-2" />
                Νέο είδος
              </Button>
            </>
          )}
          <div className="text-sm ml-2">
            <span className="text-neutral-400">Στη λίστα: </span>
            <span className="font-mono font-bold text-flame" data-testid="needs-count">
              {needsCount}
            </span>
          </div>
        </div>
      </div>

      <CategoryRail
        categories={categories}
        items={items}
        itemsCount={items.length}
        needsCount={needsCount}
        activeCat={activeCat}
        setActiveCat={setActiveCat}
        canManage={canManage}
        editMode={editMode}
        onEditCategory={(c) => setCatModal({ open: true, editing: c })}
        onDeleteCategory={handleDeleteCategory}
        onMoveCategory={handleMoveCategory}
      />

      {loading ? (
        <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
      ) : categories.length === 0 ? (
        <div className="text-neutral-500 py-12 text-center border border-dashed border-[#723645] rounded-lg">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <div className="mb-2">Δεν έχετε δημιουργήσει κατηγορίες ελλείψεων</div>
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
      ) : groups.length === 0 ? (
        <div className="text-neutral-500 py-12 text-center">
          Δεν υπάρχουν είδη σε αυτή την προβολή
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            // Όλα τα είδη της κατηγορίας στη λίστα; → το κουμπί καθαρίζει, αλλιώς επιλέγει όλα
            const allNeeded =
              g.items.length > 0 && g.items.every((i) => !!i.shopping_item_id);
            return (
            <div key={g.id} data-testid={`stock-group-${g.id}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-heading text-sm font-bold uppercase tracking-widest text-flame">
                  {g.name}
                </h3>
                <div className="flex items-center gap-2">
                  {g.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryNeeds(g, !allNeeded)}
                      data-testid={`stock-group-select-all-${g.id}`}
                      className={`h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                        allNeeded
                          ? "bg-flame/15 border-flame text-flame"
                          : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                      }`}
                      title={
                        allNeeded
                          ? "Αφαίρεση όλης της κατηγορίας από τη λίστα"
                          : "Όλη η κατηγορία στη λίστα αγορών"
                      }
                    >
                      {allNeeded ? "Καθαρισμός" : "Επιλογή όλων"}
                    </button>
                  )}
                  {canManage && editMode && (
                    <button
                      type="button"
                      onClick={() => setItemModal({ open: true, editing: null, categoryId: g.id })}
                      data-testid={`stock-group-add-item-${g.id}`}
                      className="h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider border bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
                      title={`Νέο είδος στην κατηγορία ${g.name}`}
                    >
                      + Είδος
                    </button>
                  )}
                  <span className="text-xs text-neutral-500">{g.items.length}</span>
                </div>
              </div>
              {g.items.length === 0 && (
                <div className="text-xs text-neutral-500 italic py-2">Κενή κατηγορία</div>
              )}
              <div className="space-y-2">
                {g.items.map((it, idx) => (
                  <StockRow
                    key={it.id}
                    item={it}
                    onToggleNeed={handleToggleNeed}
                    onEdit={(item) => setItemModal({ open: true, editing: item })}
                    onDelete={handleDeleteItem}
                    onMove={handleMoveItem}
                    canEdit={canManage}
                    editMode={editMode}
                    isFirst={idx === 0}
                    isLast={idx === g.items.length - 1}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
