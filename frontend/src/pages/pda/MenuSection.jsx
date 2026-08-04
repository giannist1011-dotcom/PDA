import { memo } from "react";
import MenuGrid from "@/components/pos/MenuGrid";
import MenuList from "@/components/pos/MenuList";
import CodeNumpad from "@/components/shared/CodeNumpad";
import ScheduledPanel from "./ScheduledPanel";

// Αριστερή στήλη: περιοχή προγραμματισμένων + μενού (πλέγμα ή αριθμημένη λίστα).
// ΧΩΡΙΣ padding στην κορυφή: η μπάρα αναζήτησης ακουμπά κατευθείαν στη σειρά των
// καρτελών της σελίδας (ο διακόπτης «Λίστα/Πλέγμα» ζει εκεί, inline δεξιά).
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
}) {
  const isList = menuView === "list";
  return (
    <section
      className={`relative px-3 pb-3 md:px-4 md:pb-4 xl:px-6 xl:pb-6 overflow-hidden flex-col min-h-0 flex-1 sm:flex-none ${
        mobileTab === "menu" ? "flex" : "hidden"
      } sm:flex`}
    >
      <ScheduledPanel
        orders={scheduledOrders}
        onPrintNow={onPrintScheduled}
        onCancel={onCancelScheduled}
        onOpenAll={() => setScheduledOpen(true)}
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
