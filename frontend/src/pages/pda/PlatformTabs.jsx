import { ShoppingCart } from "lucide-react";
import { platformById } from "@/lib/platforms";

// Καρτέλες στη γραμμή εργαλείων της σελίδας παραγγελιών (ίδια σειρά με το
// «Λίστα/Πλέγμα»): «Παραγγελίες» = το ταμείο/τηλεφωνικές (η κανονική προβολή,
// προεπιλογή) + μία ανά ενεργή πλατφόρμα με badge εκκρεμών. Κάθε καρτέλα
// πλατφόρμας ανοίγει ΔΙΚΟ της dashboard (PlatformTab) — όχι το πλέγμα του POS.
export default function PlatformTabs({ tab, setTab, platforms, pendingByPlatform }) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex gap-1.5 min-w-0 overflow-x-auto" data-testid="platform-tabs">
      <button
        onClick={() => setTab("orders")}
        data-testid="platform-tab-orders"
        data-state={tab === "orders" ? "on" : "off"}
        className={`shrink-0 h-10 px-4 rounded-md border text-sm font-bold flex items-center gap-2 transition-colors no-select ${
          tab === "orders"
            ? "bg-flame text-white border-flame"
            : "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame"
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
            className="shrink-0 h-10 px-4 rounded-md border text-sm font-bold flex items-center gap-2 transition-colors no-select"
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
    </div>
  );
}
