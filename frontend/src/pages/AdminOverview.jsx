import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, TrendingUp, ShoppingBag, Bot, RefreshCw } from "lucide-react";
import { apiAdminOverview, formatApiError } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/business";
import { Button } from "@/components/ui/button";
import AdminShell, { useAdminPw } from "@/components/AdminShell";

const fmtEur = (v) =>
  `${Number(v || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const btLabel = (key) => BUSINESS_TYPES.find((b) => b.key === key)?.label || key;

const Card = ({ icon: Icon, label, children }) => (
  <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">
      <Icon className="w-4 h-4 text-flame" /> {label}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, accent }) => (
  <div>
    <div className={`text-2xl font-heading font-bold ${accent || "text-white"}`}>{value}</div>
    <div className="text-xs text-neutral-500">{label}</div>
  </div>
);

function OverviewContent() {
  const pw = useAdminPw();
  const [data, setData] = useState(null);

  const load = () =>
    apiAdminOverview(pw)
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>;

  const types = Object.entries(data.by_business_type || {}).sort((a, b) => b[1] - a[1]);
  const typesTotal = types.reduce((s, [, n]) => s + n, 0) || 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={load}
          data-testid="overview-refresh"
          className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={Store} label="Μαγαζιά">
          <div className="grid grid-cols-4 gap-3" data-testid="overview-shops">
            <Stat label="Σύνολο" value={data.shops.total} />
            <Stat label="Ενεργά" value={data.shops.active} accent="text-emerald-400" />
            <Stat label="Ανενεργά" value={data.shops.disabled} accent="text-[#FF6961]" />
            <Stat label="Demo" value={data.shops.demo} accent="text-gold" />
          </div>
        </Card>
        <Card icon={TrendingUp} label="Νέες εγγραφές">
          <div className="grid grid-cols-3 gap-3" data-testid="overview-regs">
            <Stat label="Σήμερα" value={data.registrations.today} />
            <Stat label="7 ημέρες" value={data.registrations.last_7d} />
            <Stat label="30 ημέρες" value={data.registrations.last_30d} />
          </div>
        </Card>
        <Card icon={ShoppingBag} label="Χρήση πλατφόρμας (όλα τα μαγαζιά)">
          <div className="grid grid-cols-2 gap-3" data-testid="overview-usage">
            <Stat label="Παραγγελίες" value={data.orders.total.toLocaleString("el-GR")} />
            <Stat label="Συνολικός τζίρος" value={fmtEur(data.orders.revenue)} />
          </div>
        </Card>
        <Card icon={Bot} label="DeckPilot">
          <Stat
            label="Μαγαζιά που το χρησιμοποιούν"
            value={data.deckpilot_shops}
            accent="text-flame"
          />
        </Card>
      </div>

      <Card icon={Store} label="Κατανομή ανά τύπο επιχείρησης">
        {types.length === 0 ? (
          <div className="text-sm text-neutral-500">Δεν υπάρχουν εγγραφές ακόμα.</div>
        ) : (
          <div className="space-y-2.5" data-testid="overview-types">
            {types.map(([key, n]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{btLabel(key)}</span>
                  <span className="text-neutral-400">
                    {n} ({Math.round((n / typesTotal) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#2A0E14] overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${Math.max(3, (n / typesTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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
