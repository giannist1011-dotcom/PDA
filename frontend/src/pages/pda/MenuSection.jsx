import { memo } from "react";
import { LayoutGrid, List } from "lucide-react";
import MenuGrid from "@/components/pos/MenuGrid";
import MenuList from "@/components/pos/MenuList";
import CodeNumpad from "@/components/shared/CodeNumpad";
import ScheduledPanel from "./ScheduledPanel";

const VIEWS = [
  { id: "list", label: "Λίστα", Icon: List },
  { id: "grid", label: "Πλέγμα", Icon: LayoutGrid },
];

// Αριστερή στήλη: περιοχή προγραμματισμένων + μενού (πλέγμα ή αριθμημένη λίστα).
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
      <div className="flex justify-end gap-1.5 mb-2 shrink-0" data-testid="menu-view-toggle">
        {VIEWS.map(({ id, label, Icon }) => {
          const active = menuView === id;
          return (
            <button
              key={id}
              onClick={() => setMenuView(id)}
              data-testid={`menu-view-${id}`}
              data-state={active ? "on" : "off"}
              className={`h-9 px-3 flex items-center gap-1.5 rounded-md text-xs font-bold border transition-colors no-select ${
                active
                  ? "bg-flame text-white border-flame"
                  : "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

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
