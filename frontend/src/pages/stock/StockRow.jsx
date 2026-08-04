import { Check, Trash2, Pencil, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";

// ---------- Γραμμή είδους ελλείψεων (checkbox = «μπες στη λίστα αγορών») ----------
// Σε λειτουργία επεξεργασίας (editMode) εμφανίζονται μετονομασία & σειρά,
// ακριβώς όπως στη διαχείριση καταλόγου.
// Είδος με παραλλαγές: το tap ανοίγει τον picker αντί να επιλέγει κατευθείαν.
export default function StockRow({
  item,
  onToggleNeed,
  onEdit,
  onDelete,
  onMove,
  canEdit,
  editMode = false,
  isFirst = false,
  isLast = false,
}) {
  const needs = !!item.shopping_item_id;
  const variants = item.variants || [];
  const hasVariants = variants.length > 0;
  const selectedNames = hasVariants
    ? variants
        .filter((v) => (item.selected_variant_ids || []).includes(v.id))
        .map((v) => v.name)
    : [];
  const iconBtn =
    "p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400";
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
        {needs ? (
          <Check className="w-5 h-5 text-white" strokeWidth={3} />
        ) : (
          hasVariants && <ChevronRight className="w-4 h-4 text-neutral-500" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-heading font-semibold truncate ${needs ? "text-white" : "text-neutral-100"}`}>
          {item.name}
        </div>
        {needs && selectedNames.length > 0 ? (
          <div className="text-[11px] font-bold uppercase tracking-widest text-flame mt-0.5 truncate">
            {selectedNames.join(", ")}
          </div>
        ) : needs ? (
          <div className="text-[11px] font-bold uppercase tracking-widest text-flame mt-0.5">
            Στη λίστα αγορών
          </div>
        ) : (
          hasVariants && (
            <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
              {variants.length} παραλλαγές
            </div>
          )
        )}
      </div>
      {canEdit && editMode && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMove(item, -1);
            }}
            disabled={isFirst}
            data-testid={`stock-item-up-${item.id}`}
            className={iconBtn}
            title="Πάνω"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMove(item, 1);
            }}
            disabled={isLast}
            data-testid={`stock-item-down-${item.id}`}
            className={iconBtn}
            title="Κάτω"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(item);
            }}
            data-testid={`stock-item-edit-${item.id}`}
            className={iconBtn}
            title="Επεξεργασία"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(item);
          }}
          data-testid={`stock-delete-${item.id}`}
          className={`p-1.5 text-neutral-400 hover:text-[#FF3B30] ${
            editMode
              ? ""
              : "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          }`}
          title="Διαγραφή"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </label>
  );
}
