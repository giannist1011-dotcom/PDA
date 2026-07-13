import { useState } from "react";
import { eur } from "@/lib/format";

export default function MenuGrid({
  categories,
  items,
  activeCategory,
  onCategoryChange,
  onItemClick,
}) {
  const filtered = items.filter((i) => i.category === activeCategory);
  const [pulsedId, setPulsedId] = useState(null);

  const handleClick = (it) => {
    if (it.available === false) return;
    setPulsedId(it.id);
    onItemClick(it);
    setTimeout(() => setPulsedId((p) => (p === it.id ? null : p)), 240);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-3 mb-6" data-testid="category-bar">
        {categories.map((c) => {
          const active = c.id === activeCategory;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              data-testid={`category-btn-${c.id}`}
              data-state={active ? "on" : "off"}
              className={`px-6 h-14 rounded-md text-base md:text-lg font-semibold transition-all no-select active:scale-[0.98] ${
                active
                  ? "bg-flame text-white border border-flame"
                  : "bg-[#3D1620] text-neutral-200 border border-[#5E2A3A] hover:border-flame"
              }`}
            >
              {c.name}
            </button>
          );
        })}
        {categories.length === 0 && (
          <div className="text-neutral-500 text-sm">
            Δεν υπάρχουν κατηγορίες. Ανοίξτε τη «Διαχείριση Μενού» για να προσθέσετε.
          </div>
        )}
      </div>

      <div
        className="flex-1 min-h-0 content-start grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto overflow-x-hidden px-2 pt-2 pr-3 pb-6"
        data-testid="menu-items-grid"
      >
        {filtered.map((it) => {
          const unavailable = it.available === false;
          const pulsing = pulsedId === it.id;
          return (
            <button
              key={it.id}
              onClick={() => handleClick(it)}
              disabled={unavailable}
              data-testid={`menu-item-${it.id}`}
              data-available={unavailable ? "false" : "true"}
              className={`menu-item group flex flex-col justify-between p-4 rounded-lg text-left h-32 no-select relative overflow-hidden will-change-transform ${
                unavailable
                  ? "bg-[#33111A] border border-[#4F202D] cursor-not-allowed opacity-50"
                  : `bg-[#3D1620] border border-[#5E2A3A] hover:border-flame hover:scale-[1.03] hover:shadow-lg hover:shadow-gold/20 hover:bg-[#451924] active:scale-[0.96] transition-[transform,box-shadow,background-color,border-color] duration-[130ms] ease-out ${
                      pulsing ? "menu-item--pulse" : ""
                    }`
              }`}
            >
              <span className="font-heading text-lg font-semibold leading-tight text-white line-clamp-2 relative z-[1]">
                {it.name}
              </span>
              <div className="flex items-end justify-between mt-2 relative z-[1]">
                <span className="font-mono text-xl font-bold text-gold">{eur(it.price)}</span>
                {it.customizable && !unavailable && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Custom
                  </span>
                )}
                {!it.customizable && (it.option_groups || []).length > 0 && !unavailable && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Επιλογές
                  </span>
                )}
              </div>
              {unavailable && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961] text-[10px] font-bold uppercase tracking-widest">
                  Έλλειψη
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && categories.length > 0 && (
          <div className="col-span-full text-neutral-500 text-center py-16">
            Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία
          </div>
        )}
      </div>
    </div>
  );
}
