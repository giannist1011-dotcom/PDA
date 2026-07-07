import { CATEGORIES, MENU_ITEMS } from "@/data/menu";
import { eur } from "@/lib/format";

export default function MenuGrid({ activeCategory, onCategoryChange, onItemClick }) {
  const items = MENU_ITEMS.filter((i) => i.category === activeCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Categories */}
      <div className="flex flex-wrap gap-3 mb-6" data-testid="category-bar">
        {CATEGORIES.map((c) => {
          const active = c.id === activeCategory;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              data-testid={`category-btn-${c.id}`}
              data-state={active ? "on" : "off"}
              className={`px-6 h-14 rounded-md text-base md:text-lg font-semibold transition-all no-select active:scale-[0.98] ${
                active
                  ? "bg-[#FF6B00] text-white border border-[#FF6B00] shadow-[0_0_0_1px_rgba(255,107,0,0.3)]"
                  : "bg-[#1A1A1A] text-neutral-200 border border-[#333] hover:border-[#FF6B00]"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Items grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-6"
        data-testid="menu-items-grid"
      >
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onItemClick(it)}
            data-testid={`menu-item-${it.id}`}
            className="group flex flex-col justify-between p-4 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] rounded-lg text-left h-32 transition-all active:scale-[0.98] no-select"
          >
            <span className="font-heading text-lg font-semibold leading-tight text-white line-clamp-2">
              {it.name}
            </span>
            <div className="flex items-end justify-between mt-2">
              <span className="font-mono text-xl font-bold text-[#FF6B00]">
                {eur(it.price)}
              </span>
              {it.customizable && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  Custom
                </span>
              )}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-neutral-500 text-center py-16">
            Δεν υπάρχουν προϊόντα
          </div>
        )}
      </div>
    </div>
  );
}
