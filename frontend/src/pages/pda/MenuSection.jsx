import { memo } from "react";
import MenuGrid from "@/components/pos/MenuGrid";
import MenuList from "@/components/pos/MenuList";
import CodeNumpad from "@/components/shared/CodeNumpad";
import MenuViewToggle from "./MenuViewToggle";
import ScheduledPanel from "./ScheduledPanel";

// Αριστερή στήλη: περιοχή προγραμματισμένων + μενού (πλέγμα ή αριθμημένη λίστα).
// ΧΩΡΙΣ padding στην κορυφή: η μπάρα αναζήτησης ακουμπά κατευθείαν στη σειρά των
// καρτελών της σελίδας· ο διακόπτης «Λίστα/Πλέγμα» μπαίνει inline ΣΤΗΝ ΙΔΙΑ
// γραμμή με την αναζήτηση, στο δεξί της άκρο (δεν παίρνει δική του σειρά).
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
  onMenuViewChange,
}) {
  const isList = menuView === "list";
  const toolbar = <MenuViewToggle value={menuView} onChange={onMenuViewChange} />;
  return (
    <section
      className={`relative px-3 pb-3 md:px-4 md:pb-4 xl:px-6 xl:pb-6 overflow-hidden flex-col min-h-0 flex-1 ${
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
          toolbar={toolbar}
        />
      ) : (
        <MenuGrid
          categories={config.categories}
          items={config.items}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onItemClick={handleItemClick}
          toolbar={toolbar}
        />
      )}

      {isList && <CodeNumpad items={config.items} onItemClick={handleItemClick} />}
    </section>
  );
}

export default memo(MenuSection);
