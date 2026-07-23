import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminShell, { MasterOnly } from "@/components/AdminShell";
import ShopsContent from "./admin-shops/ShopsContent";
import CreateDemoModal from "./admin-shops/CreateDemoModal";

// Re-exports για συμβατότητα με άλλες admin σελίδες (π.χ. AdminSubscriptions)
export { PLAN_LABELS, PAYMENT_LABELS } from "./admin-shops/utils";
export { StatusBadge } from "./admin-shops/Badges";

export default function AdminShops() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <AdminShell
      title="Μαγαζιά"
      subtitle="Όλοι οι λογαριασμοί της πλατφόρμας"
      actions={
        <>
          {/* Δημιουργία demo: master-only ενέργεια */}
          <MasterOnly>
            <Button
              type="button"
              onClick={() => setDemoOpen(true)}
              data-testid="shops-create-demo"
              className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-gold text-gold text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 mr-1.5" /> Δημιουργία demo
            </Button>
          </MasterOnly>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </>
      }
    >
      <ShopsContent />
      {demoOpen && (
        <CreateDemoModal
          defaultType="store"
          onClose={(created) => {
            setDemoOpen(false);
            if (created) window.location.reload();
          }}
        />
      )}
    </AdminShell>
  );
}
