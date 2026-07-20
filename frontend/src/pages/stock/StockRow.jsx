import { Check, Trash2 } from "lucide-react";

// ---------- Stock row (checkbox = "add to shopping list") ----------
export default function StockRow({ item, onToggleNeed, onDelete, canEdit }) {
  const needs = !!item.shopping_item_id;
  return (
    <label
      className={`p-4 bg-[#3D1620] border rounded-lg flex items-center gap-4 group cursor-pointer select-none transition-colors ${
        needs
          ? "border-flame bg-flame/5"
          : "border-[#723645] hover:border-[#7A3E52]"
      }`}
      data-testid={`stock-row-${item.id}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleNeed(item);
        }}
        data-testid={`stock-check-${item.id}`}
        aria-checked={needs}
        role="checkbox"
        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          needs
            ? "bg-brand border-brand"
            : "border-[#7A3E52] hover:border-flame bg-[#2A0E14]"
        }`}
      >
        {needs && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-heading font-semibold truncate ${needs ? "text-white" : "text-neutral-100"}`}>
          {item.name}
        </div>
        {needs && (
          <div className="text-[11px] font-bold uppercase tracking-widest text-flame mt-0.5">
            Στη λίστα αγορών
          </div>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(item);
          }}
          data-testid={`stock-delete-${item.id}`}
          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-[#FF3B30]"
          title="Διαγραφή"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </label>
  );
}
