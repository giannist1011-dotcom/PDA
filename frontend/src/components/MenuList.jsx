import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { eur } from "@/lib/format";
import { normText } from "@/lib/text";
import { searchItems, findExactCode, isAmbiguousCode, sortByCode } from "@/lib/menuSearch";

// Αριθμημένη λίστα — «το τεστ του 60χρονου»: κατηγορίες 1., 2., 3. στο πλάι και
// προϊόντα με τον ΚΩΔΙΚΟ τους μπροστά («14  Γύρος χοιρινός   3,50 €»). Μεγάλες
// επιφάνειες αφής, καμία εικόνα υποχρεωτική.
export default function MenuList({
  categories,
  items,
  activeCategory,
  onCategoryChange,
  onItemClick,
}) {
  const [pulsedId, setPulsedId] = useState(null);
  const [query, setQuery] = useState("");
  const q = normText(query.trim());

  const handleClick = (it) => {
    if (it.available === false) return;
    setPulsedId(it.id);
    onItemClick(it);
    setTimeout(() => setPulsedId((p) => (p === it.id ? null : p)), 240);
  };

  const searchResults = useMemo(() => searchItems(items, q), [q, items]);

  const rows = useMemo(() => {
    const base = q ? searchResults : items.filter((i) => i.category === activeCategory);
    return sortByCode(base || []);
  }, [q, searchResults, items, activeCategory]);

  const selectAndClear = (it) => {
    handleClick(it);
    setQuery("");
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    const exact = findExactCode(items, value);
    if (!exact || exact.available === false) return;
    if (!isAmbiguousCode(items, exact, value)) selectAndClear(exact);
  };

  const handleQueryKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exact = findExactCode(items, query);
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
          data-testid="menu-list-search-input"
          className="w-full h-10 pl-9 pr-9 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-flame"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            data-testid="menu-list-search-clear"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex gap-2 lg:gap-3">
        {/* Αριθμημένες κατηγορίες */}
        {!q && (
          <nav
            className="w-[7.5rem] sm:w-40 lg:w-48 shrink-0 overflow-y-auto no-scrollbar space-y-1.5 pb-6"
            data-testid="menu-list-categories"
          >
            {categories.map((c, ci) => {
              const active = c.id === activeCategory;
              return (
                <button
                  key={c.id}
                  onClick={() => onCategoryChange(c.id)}
                  data-testid={`category-btn-${c.id}`}
                  data-state={active ? "on" : "off"}
                  className={`w-full flex items-center gap-2 px-2.5 sm:px-3 min-h-[3.25rem] rounded-md text-left no-select active:scale-[0.98] transition-colors border ${
                    active
                      ? "bg-flame text-white border-flame"
                      : "bg-[#4A1B27] text-neutral-200 border-[#723645] hover:border-flame"
                  }`}
                >
                  <span
                    className={`font-mono text-base font-bold shrink-0 ${
                      active ? "text-white" : "text-gold"
                    }`}
                  >
                    {ci + 1}.
                  </span>
                  <span className="font-semibold text-sm sm:text-base leading-tight">{c.name}</span>
                </button>
              );
            })}
            {categories.length === 0 && (
              <div className="text-neutral-500 text-sm">
                Δεν υπάρχουν κατηγορίες. Ανοίξτε τη «Διαχείριση Μενού» για να προσθέσετε.
              </div>
            )}
          </nav>
        )}

        {/* Αριθμημένα προϊόντα — ο αριθμός ΕΙΝΑΙ ο κωδικός */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1.5 pr-1 pb-6"
          data-testid="menu-items-list"
        >
          {rows.map((it) => {
            const unavailable = it.available === false;
            const code = String(it.code ?? "").trim();
            const pulsing = pulsedId === it.id;
            return (
              <button
                key={it.id}
                onClick={() => handleClick(it)}
                disabled={unavailable}
                data-testid={`menu-item-${it.id}`}
                data-available={unavailable ? "false" : "true"}
                className={`menu-item w-full flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 min-h-[3.25rem] rounded-md text-left no-select border transition-colors ${
                  unavailable
                    ? "bg-[#33111A] border-[#4F202D] cursor-not-allowed opacity-50"
                    : `bg-[#4A1B27] border-[#723645] hover:border-flame hover:bg-[#582233] active:scale-[0.99] ${
                        pulsing ? "menu-item--pulse" : ""
                      }`
                }`}
              >
                <span
                  className={`font-mono text-lg sm:text-xl font-bold w-[2.75rem] sm:w-[3.25rem] shrink-0 text-right tabular-nums ${
                    code ? "text-gold" : "text-neutral-600"
                  }`}
                  data-testid={`menu-item-code-${it.id}`}
                >
                  {code || "–"}
                </span>
                {it.photo_url && (
                  <img
                    src={it.photo_url}
                    alt=""
                    loading="lazy"
                    className="w-10 h-10 rounded object-cover bg-[#2A0E14] shrink-0"
                  />
                )}
                <span className="flex-1 min-w-0 font-heading text-base sm:text-lg font-semibold text-white leading-tight line-clamp-2">
                  {it.name}
                </span>
                {(it.customizable || (it.option_groups || []).length > 0) && !unavailable && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    {it.customizable ? "Custom" : "Επιλογές"}
                  </span>
                )}
                {unavailable && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961] text-[10px] font-bold uppercase tracking-widest">
                    Έλλειψη
                  </span>
                )}
                <span className="font-mono text-lg sm:text-xl font-bold text-gold shrink-0 tabular-nums">
                  {eur(it.price)}
                </span>
              </button>
            );
          })}
          {rows.length === 0 && categories.length > 0 && (
            <div className="text-neutral-500 text-center py-16">
              {q
                ? "Δεν βρέθηκαν προϊόντα για την αναζήτηση"
                : "Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
