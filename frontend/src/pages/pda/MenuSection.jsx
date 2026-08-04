import { memo } from "react";
import MenuGrid from "@/components/pos/MenuGrid";
import MenuList from "@/components/pos/MenuList";
import CodeNumpad from "@/components/shared/CodeNumpad";
import ScheduledPanel from "./ScheduledPanel";
import MenuViewToggle from "./MenuViewToggle";

// Αριστερή στήλη: περιοχή προγραμματισμένων + μενού (πλέγμα ή αριθμημένη λίστα).
// Ο διακόπτης «Λίστα/Πλέγμα» ζει ΕΔΩ, πάνω δεξιά στην περιοχή προϊόντων —
// αφορά μόνο την καρτέλα «Παραγγελίες», όχι τις καρτέλες πλατφορμών.
// memo: το μενού ΔΕΝ ξαναρεντάρεται όταν αλλάζει state της δεξιάς στήλης
// (π.χ. πληκτρολόγηση διεύθυνσης) — όλα τα props εδώ μένουν σταθερά τότε
// (οι handlers έρχονται useCallback-αρισμένοι από το PDA)
function MenuSection({
  mobileTab,
  scheduledOrders,
  setScheduledOpen,
  onPrintScheduled,
  onCancelScheduled,
  config,
  activeCategory,
  setActiveCategory,
  handleItemClick,
  menuView,
  setMenuView,
}) {
  const isList = menuView === "list";
  return (
    <section
      className={`relative p-3 md:p-4 xl:p-6 overflow-hidden flex-col min-h-0 flex-1 sm:flex-none ${
        mobileTab === "menu" ? "flex" : "hidden"
      } sm:flex`}
    >
      <ScheduledPanel
        orders={scheduledOrders}
        onPrintNow={onPrintScheduled}
        onCancel={onCancelScheduled}
        onOpenAll={() => setScheduledOpen(true)}
      />

      {/* Προβολή προϊόντων — η επιλογή μένει αποθηκευμένη στη συσκευή/προφίλ */}
      <MenuViewToggle
        value={menuView}
        onChange={setMenuView}
        className="flex justify-end mb-2 shrink-0"
      />

      {isList ? (
        <MenuList
          categories={config.categories}
          items={config.items}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onItemClick={handleItemClick}
        />
      ) : (
        <MenuGrid
          categories={config.categories}
          items={config.items}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onItemClick={handleItemClick}
        />
      )}

      {isList && <CodeNumpad items={config.items} onItemClick={handleItemClick} />}
    </section>
  );
}

export default memo(MenuSection);
