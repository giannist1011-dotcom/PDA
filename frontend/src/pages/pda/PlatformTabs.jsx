import { ShoppingCart, Send } from "lucide-react";
import { platformById } from "@/lib/platforms";

// Καρτέλες στην ΚΟΡΥΦΗ της σελίδας παραγγελιών (πάνω από την αναζήτηση):
// «Παραγγελίες» = όλο το POS (ταμείο + τηλεφωνικές, η προεπιλογή) · μία καρτέλα
// ανά ΕΝΕΡΓΗ πλατφόρμα (efood/Box/Wolt) με badge εκκρεμών, που ανοίγει ΔΙΚΟ της
// dashboard — όχι panel μέσα στο POS · «Αποστολή παραγγελίας» = η μελλοντική
// προβολή ανεβάσματος στο OrderDeck Fleet — εμφανίζεται ΜΟΝΟ σε καταστήματα
// με πλάνο orderdeck_fleet (showDispatch), αλλιώς δεν υπάρχει καθόλου.
const TAB_BASE =
  "shrink-0 h-10 px-4 rounded-md border text-sm font-bold flex items-center gap-2 transition-colors no-select";
const TAB_OFF = "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame";

export default function PlatformTabs({
  tab,
  setTab,
  platforms,
  pendingByPlatform,
  showDispatch,
  right = null,
}) {
  return (
    <div
      className="shrink-0 flex items-center gap-1.5 px-3 md:px-4 xl:px-6 pt-2 pb-1.5 overflow-x-auto"
      data-testid="platform-tabs"
    >
      <button
        onClick={() => setTab("orders")}
        data-testid="platform-tab-orders"
        data-state={tab === "orders" ? "on" : "off"}
        className={`${TAB_BASE} ${
          tab === "orders" ? "bg-flame text-white border-flame" : TAB_OFF
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        Παραγγελίες
      </button>
      {platforms.map((p) => {
        const meta = platformById(p);
        const count = pendingByPlatform[p] || 0;
        const active = tab === p;
        return (
          <button
            key={p}
            onClick={() => setTab(p)}
            data-testid={`platform-tab-${p}`}
            data-state={active ? "on" : "off"}
            className={TAB_BASE}
            style={
              active
                ? { backgroundColor: meta.accent, borderColor: meta.accent, color: "#fff" }
                : { backgroundColor: "#4A1B27", borderColor: "#723645", color: "#d4d4d4" }
            }
          >
            {meta.label}
            {count > 0 && (
              <span
                data-testid={`platform-badge-${p}`}
                className={`min-w-5 h-5 px-1 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                  active ? "bg-white text-black" : "text-white animate-pulse"
                }`}
                style={active ? undefined : { backgroundColor: meta.accent }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
      {showDispatch && (
      <button
        onClick={() => setTab("dispatch")}
        data-testid="platform-tab-dispatch"
        data-state={tab === "dispatch" ? "on" : "off"}
        className={`${TAB_BASE} ${
          tab === "dispatch" ? "bg-flame text-white border-flame" : TAB_OFF
        }`}
      >
        <Send className="w-4 h-4" />
        Αποστολή παραγγελίας
      </button>
      )}
      {/* Δεξιά στην ΙΔΙΑ σειρά: ο διακόπτης «Λίστα/Πλέγμα» — δεν παίρνει δική
          του γραμμή, ώστε τα tabs να ακουμπούν πάνω στην αναζήτηση προϊόντων */}
      {right && <div className="ml-auto shrink-0 pl-2">{right}</div>}
    </div>
  );
}
