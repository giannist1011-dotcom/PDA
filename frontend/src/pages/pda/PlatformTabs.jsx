import { ShoppingCart, Send } from "lucide-react";
import { platformById } from "@/lib/platforms";

// Καρτέλες της σελίδας παραγγελιών — ζουν ΜΕΣΑ στο header bar (AppShell
// headerTabs), δεξιά από το «<Κατάστημα> · ΠΑΡΑΓΓΕΛΙΕΣ», σε compact μορφή pills:
// «Παραγγελίες» = όλο το POS (ταμείο + τηλεφωνικές, η προεπιλογή) · μία καρτέλα
// ανά ΕΝΕΡΓΗ πλατφόρμα (efood/Box/Wolt) με badge εκκρεμών, που ανοίγει ΔΙΚΟ της
// dashboard — όχι panel μέσα στο POS · «Αποστολή παραγγελίας» = ανέβασμα στην
// εταιρεία διανομής — ΜΟΝΟ σε καταστήματα με πλάνο orderdeck_fleet (showDispatch).
// Σε στενά πλάτη η γραμμή γίνεται scrollable μέσα στο header (no-scrollbar).
const TAB_BASE =
  "shrink-0 h-9 px-3 rounded-full border text-[13px] font-bold flex items-center gap-1.5 transition-colors no-select";
const TAB_OFF = "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame";

export default function PlatformTabs({
  tab,
  setTab,
  platforms,
  pendingByPlatform,
  showDispatch,
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" data-testid="platform-tabs">
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
          Αποστολή
          <span className="hidden xl:inline">παραγγελίας</span>
        </button>
      )}
    </div>
  );
}
