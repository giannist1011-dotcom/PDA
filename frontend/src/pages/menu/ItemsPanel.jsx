import {
  Plus,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/format";
import { emptyItem } from "./utils";

export default function ItemsPanel({
  config,
  activeCat,
  filteredItems,
  editMode,
  selectedIds,
  allSelected,
  toggleSelect,
  toggleSelectAll,
  setEditingItem,
  setItemModalOpen,
  setConfirmItem,
  dragItemId,
  setDragItemId,
  dropItem,
  moveItem,
}) {
  return (
    <section className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">
          {config.categories.find((c) => c.id === activeCat)?.name || "Προϊόντα"}
        </h2>
        <Button
          onClick={() => {
            setEditingItem(emptyItem(activeCat));
            setItemModalOpen(true);
          }}
          disabled={!activeCat || editMode}
          data-testid="add-item-btn"
          className="bg-brand hover:bg-brand-hover font-bold"
        >
          <Plus className="w-4 h-4 mr-2" /> Νέο προϊόν
        </Button>
      </div>

      {editMode && filteredItems.length > 0 && (
        <div className="mb-3">
          <button
            onClick={toggleSelectAll}
            data-testid="select-all-btn"
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-bold border transition-colors ${
              allSelected
                ? "bg-flame/15 border-flame text-flame"
                : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
            }`}
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? "Αποεπιλογή όλων" : "Επιλογή όλων της κατηγορίας"}
          </button>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="text-center text-neutral-500 py-12">
          Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredItems.map((it, ii) => {
            const checked = selectedIds.includes(it.id);
            return (
            <div
              key={it.id}
              data-testid={`mgmt-item-${it.id}`}
              onClick={() => editMode && toggleSelect(it.id)}
              draggable={editMode}
              onDragStart={(e) => {
                if (!editMode) return;
                setDragItemId(it.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => editMode && e.preventDefault()}
              onDrop={(e) => {
                if (!editMode) return;
                e.preventDefault();
                dropItem(it.id);
                setDragItemId(null);
              }}
              onDragEnd={() => setDragItemId(null)}
              className={`p-4 bg-[#2A0E14] border rounded-lg flex justify-between items-start transition-colors ${
                editMode ? "cursor-pointer" : ""
              } ${dragItemId === it.id ? "opacity-40" : ""} ${
                checked
                  ? "border-flame bg-flame/5"
                  : "border-[#723645] hover:border-[#6B3345]"
              }`}
            >
              {editMode && (
                <div className="flex flex-col items-center gap-2 mr-3 shrink-0">
                  <div
                    className={`w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center ${
                      checked ? "bg-brand border-brand" : "border-[#7A3E52]"
                    }`}
                    data-testid={`select-item-${it.id}`}
                  >
                    {checked && <CheckSquare className="w-4 h-4 text-white" />}
                  </div>
                  <GripVertical className="w-5 h-5 text-neutral-500 cursor-grab touch-none" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-white truncate">{it.name}</div>
                <div className="font-mono text-gold font-bold mt-1">{eur(it.price)}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {it.customizable && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-flame/15 text-flame">
                      Custom
                    </span>
                  )}
                  {it.double_meat_eligible && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                      Διπλό
                    </span>
                  )}
                  {(it.option_groups || []).length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#00B0FF]/15 text-[#00B0FF]">
                      {it.option_groups.length} ομ.
                    </span>
                  )}
                  {it.available === false && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/15 text-[#FF6961]">
                      Έλλειψη
                    </span>
                  )}
                </div>
              </div>
              {editMode ? (
                <div className="flex flex-col gap-1 ml-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveItem(ii, -1);
                    }}
                    disabled={ii === 0}
                    data-testid={`item-up-${it.id}`}
                    className="p-2.5 rounded-md border border-[#723645] text-neutral-300 hover:text-white hover:border-flame disabled:opacity-30 disabled:hover:text-neutral-300 disabled:hover:border-[#723645]"
                    title="Πάνω"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveItem(ii, 1);
                    }}
                    disabled={ii === filteredItems.length - 1}
                    data-testid={`item-down-${it.id}`}
                    className="p-2.5 rounded-md border border-[#723645] text-neutral-300 hover:text-white hover:border-flame disabled:opacity-30 disabled:hover:text-neutral-300 disabled:hover:border-[#723645]"
                    title="Κάτω"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1 ml-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem(it);
                      setItemModalOpen(true);
                    }}
                    data-testid={`edit-item-${it.id}`}
                    className="p-2 text-neutral-400 hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmItem(it);
                    }}
                    data-testid={`delete-item-${it.id}`}
                    className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
