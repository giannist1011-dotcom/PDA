import { memo } from "react";
import MenuGrid from "@/components/MenuGrid";
import ScheduledPanel from "./ScheduledPanel";

// Αριστερή στήλη: περιοχή προγραμματισμένων + πλέγμα μενού.
// memo: το πλέγμα ΔΕΝ ξαναρεντάρεται όταν αλλάζει state της δεξιάς στήλης
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
}) {
  return (
    <section
      className={`p-3 md:p-4 xl:p-6 overflow-hidden flex-col min-h-0 flex-1 sm:flex-none ${
        mobileTab === "menu" ? "flex" : "hidden"
      } sm:flex`}
    >
      <ScheduledPanel
        orders={scheduledOrders}
        onPrintNow={onPrintScheduled}
        onCancel={onCancelScheduled}
        onOpenAll={() => setScheduledOpen(true)}
      />
      <MenuGrid
        categories={config.categories}
        items={config.items}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onItemClick={handleItemClick}
      />
    </section>
  );
}

export default memo(MenuSection);
