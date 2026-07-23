import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminShell from "@/components/AdminShell";
import FleetContent from "./admin-fleet/FleetContent";
import CreateDemoModal from "./admin-shops/CreateDemoModal";

export default function AdminFleet() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <AdminShell
      title="Εταιρίες Delivery"
      subtitle="Λογαριασμοί OrderDeck Fleet (εταιρείες διανομής)"
      actions={
        <>
          <Button
            type="button"
            onClick={() => setDemoOpen(true)}
            data-testid="fleet-create-demo"
            className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-gold text-gold text-xs font-bold"
          >
            <Sparkles className="w-4 h-4 mr-1.5" /> Δημιουργία demo
          </Button>
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
      <FleetContent />
      {demoOpen && (
        <CreateDemoModal
          defaultType="fleet"
          onClose={(created) => {
            setDemoOpen(false);
            if (created) window.location.reload();
          }}
        />
      )}
    </AdminShell>
  );
}
