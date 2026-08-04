import AppShell from "@/components/shared/AppShell";
import AddItemModal from "./stock/AddItemModal";
import CategoryModal from "./stock/CategoryModal";
import StockSection from "./stock/StockSection";
import ShoppingListPanel from "./stock/ShoppingListPanel";
import PrintHistoryModal from "./stock/PrintHistoryModal";
import VariantPickerModal from "./stock/VariantPickerModal";
import MergeVariantsModal from "./stock/MergeVariantsModal";
import useStockPage from "./stock/useStockPage";

// ---------- Ελλείψεις: είδη (με προαιρετικές παραλλαγές) → λίστα αγορών ----------
export default function Stock() {
  const s = useStockPage();

  return (
    <AppShell title="Ελλείψεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Κατηγορίες ελλείψεων με τα είδη τους */}
          <StockSection
            canManage={s.canManage}
            categories={s.categories}
            items={s.items}
            needsCount={s.needsCount}
            activeCat={s.activeCat}
            setActiveCat={s.setActiveCat}
            editMode={s.editMode}
            setEditMode={s.toggleEditMode}
            setCatModal={s.setCatModal}
            setItemModal={s.setItemModal}
            onMergeVariants={() => s.setMergeOpen(true)}
            handleDeleteCategory={s.handleDeleteCategory}
            handleMoveCategory={s.handleMoveCategory}
            handleMoveItem={s.handleMoveItem}
            loading={s.loading}
            groups={s.groups}
            handleToggleNeed={s.handleToggleNeed}
            handleToggleCategoryNeeds={s.handleToggleCategoryNeeds}
            handleDeleteItem={s.handleDeleteItem}
          />

          {/* Shopping list */}
          <ShoppingListPanel
            shopping={s.shopping}
            groups={s.shoppingGroups}
            categories={s.categories}
            canManage={s.canManage}
            shopText={s.shopText}
            setShopText={s.setShopText}
            shopCat={s.shopCat}
            setShopCat={s.setShopCat}
            addShopItem={s.addShopItem}
            toggleShopBought={s.toggleShopBought}
            removeShop={s.removeShop}
            onPrint={s.onPrint}
            onHistory={() => s.setHistoryOpen(true)}
          />
        </div>
      </main>

      <CategoryModal
        open={s.catModal.open}
        onClose={() => s.setCatModal({ open: false, editing: null })}
        onSubmit={(name) =>
          s.catModal.editing
            ? s.handleRenameCategory(s.catModal.editing.id, name)
            : s.handleCreateCategory(name)
        }
        initialName={s.catModal.editing?.name || ""}
        title={s.catModal.editing ? "Μετονομασία κατηγορίας" : "Νέα κατηγορία"}
      />
      <AddItemModal
        open={s.itemModal.open}
        onClose={() => s.setItemModal({ open: false, editing: null })}
        categories={s.categories}
        editing={s.itemModal.editing}
        defaultCategoryId={
          s.itemModal.categoryId ||
          (s.activeCat !== "all" && s.activeCat !== "needs" ? s.activeCat : "")
        }
        onSubmit={s.handleSubmitItem}
      />
      <VariantPickerModal
        open={s.variantModal.open}
        item={s.variantModal.item}
        onClose={() => s.setVariantModal({ open: false, item: null })}
        onConfirm={s.handleConfirmVariants}
      />
      <MergeVariantsModal
        open={s.mergeOpen}
        onClose={() => s.setMergeOpen(false)}
        onApply={s.handleMergeVariants}
      />
      <PrintHistoryModal
        open={s.historyOpen}
        onClose={() => s.setHistoryOpen(false)}
        restaurantName={s.restaurantName}
        categories={s.categories}
      />
    </AppShell>
  );
}
