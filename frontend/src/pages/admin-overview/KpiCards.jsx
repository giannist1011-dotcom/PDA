import { Store, Truck, Euro, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmtEur } from "./utils";

// Βελάκι τάσης vs προηγούμενο 30ήμερο — πράσινο πάνω / κόκκινο κάτω / γκρι ίσο
const Trend = ({ now, prev, suffix = "" }) => {
  const diff = (now || 0) - (prev || 0);
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const cls = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-[#FF6961]" : "text-neutral-500";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {diff > 0 ? "+" : ""}
      {suffix === "€" ? fmtEur(diff) : diff}
      <span className="text-neutral-500 font-normal">/ 30ημ</span>
    </span>
  );
};

const Card = ({ icon: Icon, label, value, trend, children, testid }) => (
  <div
    className="bg-[#3D1620] border border-[#723645] rounded-lg p-4 flex flex-col gap-2"
    data-testid={testid}
  >
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400">
      <Icon className="w-4 h-4 text-flame" /> {label}
    </div>
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-3xl font-heading font-bold text-white">{value}</span>
      {trend}
    </div>
    {children}
  </div>
);

const Mini = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
    <span className="font-mono font-bold text-neutral-200">{value}</span> {label}
  </span>
);

// Τα μεγάλα νούμερα της πλατφόρμας — demo λογαριασμοί ΕΚΤΟΣ των headline αριθμών.
// ΑΠΟΡΡΗΤΟ ΠΕΛΑΤΗ: κανένα KPI παραγγελιών/τζίρου μαγαζιών — μετράμε λογαριασμούς
// και το MRR των δικών μας συνδρομών.
export default function KpiCards({ kpis }) {
  const { shops, companies, mrr } = kpis;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card
        icon={Store}
        label="Ενεργά μαγαζιά"
        value={shops.active}
        trend={<Trend now={shops.new_30d} prev={shops.prev_30d} />}
        testid="kpi-shops"
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Mini label="OrderDeck" value={shops.by_plan.orderdeck || 0} />
          <Mini label="FleetDeck" value={shops.by_plan.fleet || 0} />
          <Mini label="OD Fleet" value={shops.by_plan.orderdeck_fleet || 0} />
        </div>
      </Card>
      <Card
        icon={Truck}
        label="Εταιρίες delivery"
        value={companies.active}
        trend={<Trend now={companies.new_30d} prev={companies.prev_30d} />}
        testid="kpi-companies"
      >
        <Mini label="ενεργοί διανομείς" value={companies.drivers} />
      </Card>
      <Card
        icon={Euro}
        label="MRR εκτίμηση"
        value={fmtEur(mrr.total)}
        trend={<Trend now={mrr.added_30d} prev={0} suffix="€" />}
        testid="kpi-mrr"
      >
        <Mini label="ενεργές συνδρομές" value={mrr.paying_accounts} />
      </Card>
    </div>
  );
}
