import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MenuToolbar({ editMode, exitEdit, setEditMode, setCustModalOpen }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-[#431A25]">
      <Button
        onClick={() => (editMode ? exitEdit() : setEditMode(true))}
        data-testid="toggle-edit-mode-btn"
        className={`h-11 ${
          editMode
            ? "bg-brand hover:bg-brand-hover text-white"
            : "bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
        }`}
      >
        {editMode ? (
          <>
            <X className="w-4 h-4 mr-2" /> Τέλος
          </>
        ) : (
          <>
            <Pencil className="w-4 h-4 mr-2" /> Επεξεργασία
          </>
        )}
      </Button>
      <Button
        onClick={() => setCustModalOpen(true)}
        data-testid="open-customization-config-btn"
        className="bg-[#3D1620] border border-[#723645] hover:border-flame text-white h-11"
      >
        Επιλογές παραμετροποίησης
      </Button>
    </div>
  );
}
