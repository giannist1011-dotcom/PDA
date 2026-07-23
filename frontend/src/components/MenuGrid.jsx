import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { eur } from "@/lib/format";
import { normText } from "@/lib/text";

export default function MenuGrid({
  categories,
  items,
  activeCategory,
  onCategoryChange,
  onItemClick,
}) {
  const [pulsedId, setPulsedId] = useState(null);
  // Αναζήτηση προϊόντος: όνομα (χωρίς τόνους) ή κωδικός — σε ΟΛΕΣ τις κατηγορίες
  const [query, setQuery] = useState("");
  const q = normText(query.trim());

  const handleClick = (it) => {
    if (it.available === false) return;
    setPulsedId(it.id);
    onItemClick(it);
    setTimeout(() => setPulsedId((p) => (p === it.id ? null : p)), 240);
  };

  const searchResults = useMemo(() => {
    if (!q) return null;
    return items.filter(
      (i) => normText(i.name).includes(q) || (i.code && normText(String(i.code)).includes(q))
    );
  }, [q, items]);

  const filtered = q ? searchResults : items.filter((i) => i.category === activeCategory);

  // Ακριβής κωδικός → άμεση επιλογή προϊόντος. Άμεσα μόνο όταν κανένας άλλος
  // κωδικός δεν ξεκινά με ό,τι γράφτηκε (αλλιώς το "1" θα έκλεβε το "12") — τότε με Enter.
  const exactCodeMatch = (value) => {
    const v = normText(value.trim());
    if (!v) return null;
    return items.find((i) => i.code && normText(String(i.code)) === v) || null;
  };

  const selectAndClear = (it) => {
    handleClick(it);
    setQuery("");
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    const exact = exactCodeMatch(value);
    if (!exact || exact.available === false) return;
    const v = normText(value.trim());
    const ambiguous = items.some(
      (i) => i !== exact && i.code && normText(String(i.code)).startsWith(v)
    );
    if (!ambiguous) selectAndClear(exact);
  };

  const handleQueryKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exact = exactCodeMatch(query);
    if (exact && exact.available !== false) {
      selectAndClear(exact);
    } else if (searchResults?.length === 1 && searchResults[0].available !== false) {
      selectAndClear(searchResults[0]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Αναζήτηση προϊόντος / κωδικός */}
      <div className="relative mb-2 lg:mb-3 shrink-0">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleQueryKeyDown}
          placeholder="Αναζήτηση προϊόντος ή κωδικός..."
          data-testid="menu-search-input"
          className="w-full h-10 pl-9 pr-9 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-flame"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            data-testid="menu-search-clear"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div
        className={`flex sm:flex-wrap gap-2 mb-3 lg:mb-4 overflow-x-auto sm:overflow-visible no-scrollbar ${
          q ? "hidden" : ""
        }`}
        data-testid="category-bar"
      >
        {categories.map((c) => {
          const active = c.id === activeCategory;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              data-testid={`category-btn-${c.id}`}
              data-state={active ? "on" : "off"}
              className={`shrink-0 whitespace-nowrap px-3.5 sm:px-4 lg:px-5 h-10 sm:h-11 lg:h-12 rounded-full sm:rounded-md text-sm sm:text-base font-semibold transition-all no-select active:scale-[0.98] ${
                active
                  ? "bg-flame text-white border border-flame"
                  : "bg-[#4A1B27] text-neutral-200 border border-[#723645] hover:border-flame"
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
        className="flex-1 min-h-0 content-start grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-y-auto overflow-x-hidden px-2 pt-2 pr-3 pb-6"
        data-testid="menu-items-grid"
      >
        {filtered.map((it) => {
          const unavailable = it.available === false;
          const pulsing = pulsedId === it.id;
          const hasPhoto = !!it.photo_url;

          const stateClasses = unavailable
            ? "bg-[#33111A] border border-[#4F202D] cursor-not-allowed opacity-50"
            : `bg-[#4A1B27] border border-[#723645] hover:border-flame hover:scale-[1.03] hover:shadow-lg hover:shadow-gold/20 hover:bg-[#582233] active:scale-[0.96] transition-[transform,box-shadow,background-color,border-color] [transition-duration:130ms] ease-out ${
                pulsing ? "menu-item--pulse" : ""
              }`;

          const nameEl = (
            <span className="font-heading text-lg font-semibold leading-tight text-white line-clamp-2 relative z-[1]">
              {it.name}
            </span>
          );

          const priceRow = (
            <div className="flex items-end justify-between mt-2 relative z-[1]">
              <span className="font-mono text-xl font-bold text-gold">{eur(it.price)}</span>
              {q && it.code && (
                <span className="font-mono text-[10px] font-bold text-neutral-500">
                  κωδ. {it.code}
                </span>
              )}
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
          );

          const unavailableBadge = unavailable && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961] text-[10px] font-bold uppercase tracking-widest">
              Έλλειψη
            </div>
          );

          const commonProps = {
            onClick: () => handleClick(it),
            disabled: unavailable,
            "data-testid": `menu-item-${it.id}`,
            "data-available": unavailable ? "false" : "true",
          };

          // Κάρτα ΜΕ φωτογραφία: εικόνα (πάνω, συμπαγής) → όνομα → τιμή
          if (hasPhoto) {
            return (
              <button
                key={it.id}
                {...commonProps}
                className={`menu-item group flex flex-col rounded-lg text-left no-select relative overflow-hidden will-change-transform ${stateClasses}`}
              >
                <img
                  src={it.photo_url}
                  alt=""
                  loading="lazy"
                  className="w-full h-24 sm:h-28 object-cover bg-[#2A0E14] relative z-[1]"
                />
                <div className="flex flex-col justify-between flex-1 p-3 relative z-[1]">
                  {nameEl}
                  {priceRow}
                </div>
                {unavailableBadge}
              </button>
            );
          }

          // Κάρτα ΧΩΡΙΣ φωτογραφία: ακριβώς όπως πριν (μόνο όνομα + τιμή)
          return (
            <button
              key={it.id}
              {...commonProps}
              className={`menu-item group flex flex-col justify-between p-4 rounded-lg text-left h-32 no-select relative overflow-hidden will-change-transform ${stateClasses}`}
            >
              {nameEl}
              {priceRow}
              {unavailableBadge}
            </button>
          );
        })}
        {filtered.length === 0 && categories.length > 0 && (
          <div className="col-span-full text-neutral-500 text-center py-16">
            {q
              ? "Δεν βρέθηκαν προϊόντα για την αναζήτηση"
              : "Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία"}
          </div>
        )}
      </div>
    </div>
  );
}
