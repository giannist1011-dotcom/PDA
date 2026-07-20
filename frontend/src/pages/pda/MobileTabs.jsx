// Μενού / Παραγγελία εναλλαγή — μόνο σε κινητό (<640px)
export default function MobileTabs({ mobileTab, setMobileTab, orderCount }) {
  return (
    <div className="sm:hidden shrink-0 flex gap-1.5 p-2 border-b border-[#723645] bg-[#2A0E14]">
      <button
        onClick={() => setMobileTab("menu")}
        data-testid="pda-tab-menu"
        data-state={mobileTab === "menu" ? "on" : "off"}
        className={`flex-1 h-12 rounded-md text-sm font-bold transition-colors ${
          mobileTab === "menu"
            ? "bg-brand text-white"
            : "bg-[#3D1620] border border-[#723645] text-neutral-300"
        }`}
      >
        Μενού
      </button>
      <button
        onClick={() => setMobileTab("order")}
        data-testid="pda-tab-order"
        data-state={mobileTab === "order" ? "on" : "off"}
        className={`flex-1 h-12 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
          mobileTab === "order"
            ? "bg-brand text-white"
            : "bg-[#3D1620] border border-[#723645] text-neutral-300"
        }`}
      >
        Παραγγελία
        {orderCount > 0 && (
          <span
            key={orderCount}
            className="pk-pop min-w-[22px] h-[22px] px-1.5 rounded-full bg-flame text-white text-xs font-bold flex items-center justify-center"
          >
            {orderCount}
          </span>
        )}
      </button>
    </div>
  );
}
