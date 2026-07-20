import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminShell from "@/components/AdminShell";
import ShopsContent from "./admin-shops/ShopsContent";

// Re-exports για συμβατότητα με άλλες admin σελίδες (π.χ. AdminSubscriptions)
export { PLAN_LABELS, PAYMENT_LABELS } from "./admin-shops/utils";
export { StatusBadge } from "./admin-shops/Badges";

export default function AdminShops() {
  return (
    <AdminShell
      title="Μαγαζιά"
      subtitle="Όλοι οι λογαριασμοί της πλατφόρμας"
      actions={
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      }
    >
      <ShopsContent />
    </AdminShell>
  );
}
