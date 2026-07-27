import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { apiAdminOverview, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AdminShell, { useAdminPw, useAdminInfo } from "@/components/AdminShell";
import KpiCards from "./admin-overview/KpiCards";
import AttentionStrip from "./admin-overview/AttentionStrip";
import ExpansionMap from "./admin-overview/ExpansionMap";
import GrowthChart from "./admin-overview/GrowthChart";
import ActivityFeed from "./admin-overview/ActivityFeed";
import CityTable from "./admin-overview/CityTable";

// Command-center dashboard της πλατφόρμας: KPIs με τάση 30 ημερών, εκκρεμότητες,
// χάρτης επέκτασης ανά πόλη, growth 12 εβδομάδων, πρόσφατη δραστηριότητα και
// πίνακας πόλεων. Οι sub-admins βλέπουν μόνο τις πόλεις ευθύνης τους (backend scope).
function OverviewContent() {
  const pw = useAdminPw();
  const info = useAdminInfo();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    apiAdminOverview(pw)
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>;

  return (
    <div className="space-y-4">
      {/* Hero — brand μπορντό/πορτοκαλί με το μονόγραμμα D */}
      <div className="rounded-lg border border-[#723645] bg-gradient-to-r from-[#3D1620] via-[#4A1B27] to-[#3D1620] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-flame to-brand flex items-center justify-center font-heading font-bold text-2xl text-white shrink-0 shadow-lg">
            D
          </div>
          <div className="min-w-0">
            <div className="font-heading text-lg font-bold leading-tight truncate">
              Κέντρο ελέγχου πλατφόρμας
            </div>
            <div className="text-xs text-neutral-400 truncate">
              {info?.is_master
                ? "Όλη η Ελλάδα · demo λογαριασμοί εκτός των βασικών αριθμών"
                : `Περιοχή ευθύνης: ${(info?.cities || []).join(", ") || "—"}`}
            </div>
          </div>
        </div>
        <Button
          type="button"
          onClick={load}
          disabled={busy}
          data-testid="overview-refresh"
          className="h-9 px-3 bg-[#2A0E14] border border-[#723645] hover:border-flame text-white shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <KpiCards kpis={data.kpis} />
      <AttentionStrip attention={data.attention} />
      <ExpansionMap cities={data.cities} geocodingPending={data.geocoding_pending} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GrowthChart growth={data.growth} />
        <ActivityFeed activity={data.activity} />
      </div>
      <CityTable cities={data.cities} />
    </div>
  );
}

export default function AdminOverview() {
  return (
    <AdminShell title="Επισκόπηση" subtitle="Συνολική εικόνα της πλατφόρμας">
      <OverviewContent />
    </AdminShell>
  );
}
