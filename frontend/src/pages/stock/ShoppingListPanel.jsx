import { Plus, Trash2, ShoppingBasket, Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------- Shopping list panel ----------
export default function ShoppingListPanel({
  shopping,
  canManage,
  shopText,
  setShopText,
  addShopItem,
  toggleShopBought,
  removeShop,
  onPrint,
}) {
  return (
    <aside className="bg-[#3D1620] border border-[#723645] rounded-lg p-5 h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="w-5 h-5 text-flame" />
          <h2 className="font-heading text-xl font-bold">Λίστα αγορών</h2>
        </div>
        <button
          onClick={onPrint}
          disabled={shopping.length === 0}
          data-testid="shopping-print-btn"
          className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-neutral-200 text-sm font-bold hover:border-flame hover:text-flame disabled:opacity-40 disabled:cursor-not-allowed"
          title="Εκτύπωση & μηδενισμός λίστας"
        >
          <Printer className="w-4 h-4" />
          Εκτύπωση
        </button>
      </div>
      {canManage ? (
        <form onSubmit={addShopItem} className="flex gap-2 mb-4">
          <input
            value={shopText}
            onChange={(e) => setShopText(e.target.value)}
            placeholder="π.χ. 5kg πατάτες"
            data-testid="shopping-input"
            className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
          />
          <Button
            type="submit"
            data-testid="shopping-add-btn"
            className="h-11 bg-brand hover:bg-brand-hover px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <div className="text-[11px] text-neutral-500 mb-4 uppercase tracking-widest">
          Η χειροκίνητη προσθήκη ειδών είναι διαθέσιμη μόνο σε ιδιοκτήτη
        </div>
      )}

      {shopping.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-8">
          Η λίστα είναι άδεια
        </div>
      ) : (
        <ul className="space-y-2">
          {shopping.map((s) => (
            <li
              key={s.id}
              data-testid={`shopping-item-${s.id}`}
              className="flex items-center gap-3 p-3 bg-[#2A0E14] border border-[#723645] rounded-md group"
            >
              <button
                onClick={() => (canManage ? toggleShopBought(s) : null)}
                disabled={!canManage}
                data-testid={`shopping-check-${s.id}`}
                className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 disabled:cursor-not-allowed ${
                  s.bought
                    ? "bg-[#00E676] border-[#00E676]"
                    : "border-[#7A3E52] hover:border-[#00E676]"
                }`}
                title={s.bought ? "Αγοράστηκε" : "Σημείωση ως αγορασμένο"}
              >
                {s.bought && <Check className="w-4 h-4 text-black" />}
              </button>
              <span
                className={`flex-1 text-sm ${
                  s.bought ? "line-through text-neutral-500" : "text-white"
                }`}
              >
                {s.text}
              </span>
              {s.source_stock_id && (
                <span
                  className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-flame/20 text-flame"
                  title="Από απόθεμα"
                >
                  Αποθ.
                </span>
              )}
              {canManage && (
                <button
                  onClick={() => removeShop(s)}
                  data-testid={`shopping-delete-${s.id}`}
                  className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-1 text-neutral-400 hover:text-[#FF3B30]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
