import { memo } from "react";
import { Clock } from "lucide-react";
import MenuGrid from "@/components/MenuGrid";
import { schedDateTime } from "./utils";

// Αριστερή στήλη: badge προγραμματισμένων + πλέγμα μενού.
// memo: το πλέγμα ΔΕΝ ξαναρεντάρεται όταν αλλάζει state της δεξιάς στήλης
// (π.χ. πληκτρολόγηση διεύθυνσης) — όλα τα props εδώ μένουν σταθερά τότε
function MenuSection({
  mobileTab,
  scheduledOrders,
  setScheduledOpen,
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
      {scheduledOrders.length > 0 && (
        <button
          onClick={() => setScheduledOpen(true)}
          data-testid="scheduled-badge-btn"
          className="mb-4 shrink-0 flex items-center gap-2 self-start max-w-full px-4 h-10 rounded-md border border-[#00B0FF]/50 bg-[#00B0FF]/10 text-[#00B0FF] text-sm font-bold hover:bg-[#00B0FF]/20 transition-colors"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="truncate">Προγραμματισμένες: {scheduledOrders.length}</span>
          <span className="text-xs font-normal text-[#00B0FF]/70 hidden sm:inline shrink-0">
            · επόμενη {schedDateTime(scheduledOrders[0]?.scheduled_at)}
          </span>
        </button>
      )}
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
