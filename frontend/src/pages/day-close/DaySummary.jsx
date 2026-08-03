import {
  Receipt as ReceiptIcon,
  Euro,
  Percent,
  Ban,
  Wallet,
  Scale,
  Truck,
  ShoppingBag,
  Store,
  Smartphone,
} from "lucide-react";
import { eur } from "@/lib/format";
import SummaryRow from "./SummaryRow";
import { TYPE_LABELS } from "./utils";

const TYPE_ICONS = { delivery: Truck, takeaway: ShoppingBag, store: Store };

// Σύνοψη μιας εργάσιμης ημέρας: σύνολα + ανάλυση ανά πηγή/πλατφόρμα/τύπο
export default function DaySummary({ summary }) {
  const bySource = summary?.by_source || [];
  const byType = summary?.by_type || [];
  const byPlatform = summary?.by_platform || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
          Σύνοψη ημέρας
        </h3>
        <SummaryRow
          icon={ReceiptIcon}
          label="Παραγγελίες"
          value={summary.total_orders}
          testId="dayclose-orders"
        />
        <SummaryRow
          icon={Euro}
          label="Τζίρος"
          value={eur(summary.total_revenue)}
          valueClass="text-gold text-lg"
          testId="dayclose-revenue"
        />
        <SummaryRow
          icon={Smartphone}
          label="Από πλατφόρμες"
          value={`${eur(summary.platform_revenue || 0)} (${summary.platform_orders || 0})`}
          testId="dayclose-platforms"
        />
        <SummaryRow
          icon={Percent}
          label="Σύνολο εκπτώσεων"
          value={`-${eur(summary.total_discounts)}`}
          valueClass="text-[#00E676]"
          testId="dayclose-discounts"
        />
        <SummaryRow
          icon={Ban}
          label="Ακυρωμένες παραγγελίες"
          value={summary.cancelled_count}
          valueClass="text-[#FF6961]"
          testId="dayclose-cancelled"
        />
        <SummaryRow
          icon={Wallet}
          label="Έξοδα ημέρας"
          value={`-${eur(summary.total_expenses)}`}
          valueClass="text-gold"
          testId="dayclose-expenses"
        />
        <SummaryRow
          icon={Scale}
          label="Καθαρό αποτέλεσμα"
          value={eur(summary.net_result)}
          valueClass={
            summary.net_result >= 0 ? "text-[#00E676] text-lg" : "text-[#FF6961] text-lg"
          }
          testId="dayclose-net"
        />
      </section>

      <section className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
          Ανά πηγή
        </h3>
        {bySource.length === 0 ? (
          <div className="text-neutral-500 text-sm py-3">Δεν υπάρχουν παραγγελίες</div>
        ) : (
          <div className="space-y-2 mb-5">
            {bySource.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between text-sm"
                data-testid={`dayclose-source-${s.source}`}
              >
                <span className="text-neutral-300">
                  {s.source} <span className="text-neutral-500">({s.count})</span>
                </span>
                <span className="font-mono font-bold text-white">{eur(s.revenue)}</span>
              </div>
            ))}
          </div>
        )}

        {byPlatform.length > 0 && (
          <>
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
              Πλατφόρμες
            </h3>
            <div className="space-y-2 mb-5">
              {byPlatform.map((p) => (
                <div
                  key={p.source}
                  className="flex items-center justify-between text-sm"
                  data-testid={`dayclose-platform-${p.source}`}
                >
                  <span className="flex items-center gap-2 text-neutral-300">
                    <Smartphone className="w-4 h-4 text-flame" />
                    {p.source} <span className="text-neutral-500">({p.count})</span>
                  </span>
                  <span className="font-mono font-bold text-white">{eur(p.revenue)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm border-t border-[#723645] pt-2">
                <span className="text-neutral-400 font-bold">Σύνολο πλατφορμών</span>
                <span className="font-mono font-bold text-gold">
                  {eur(summary.platform_revenue || 0)}
                </span>
              </div>
            </div>
          </>
        )}

        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
          Ανά τύπο
        </h3>
        {byType.length === 0 ? (
          <div className="text-neutral-500 text-sm py-3">Δεν υπάρχουν παραγγελίες</div>
        ) : (
          <div className="space-y-2">
            {byType.map((t) => {
              const Icon = TYPE_ICONS[t.type] || Store;
              return (
                <div
                  key={t.type}
                  className="flex items-center justify-between text-sm"
                  data-testid={`dayclose-type-${t.type}`}
                >
                  <span className="flex items-center gap-2 text-neutral-300">
                    <Icon className="w-4 h-4 text-flame" />
                    {TYPE_LABELS[t.type] || t.type}{" "}
                    <span className="text-neutral-500">({t.count})</span>
                  </span>
                  <span className="font-mono font-bold text-white">{eur(t.revenue)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
