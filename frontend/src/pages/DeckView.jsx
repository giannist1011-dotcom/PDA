import { useEffect, useRef, useState } from "react";
import {
  Euro,
  Receipt as ReceiptIcon,
  TrendingUp,
  LayoutGrid,
  Users,
  Wallet,
  Scale,
  RefreshCcw,
  ListChecks,
} from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { fetchDeckOverview } from "@/lib/api";
import { eur, formatGRTime } from "@/lib/format";

const REFRESH_MS = 60000;

const BigCard = ({ icon: Icon, label, value, sub, valueClass = "text-white", iconClass = "text-flame", testId }) => (
  <div
    className="p-5 md:p-6 bg-[#3D1620] border border-[#723645] rounded-lg"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        {label}
      </span>
      <Icon className={`w-5 h-5 ${iconClass}`} />
    </div>
    <div className={`font-mono text-3xl md:text-4xl font-bold mt-3 ${valueClass}`}>
      {value}
    </div>
    {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
  </div>
);

const Panel = ({ icon: Icon, title, children, testId }) => (
  <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid={testId}>
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-flame" />
      <h2 className="font-heading font-semibold text-lg">{title}</h2>
    </div>
    {children}
  </div>
);

export default function DeckView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const d = await fetchDeckOverview();
      setData(d);
      setError(null);
    } catch (e) {
      setError("Σφάλμα φόρτωσης");
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const net = data?.net_result ?? 0;

  return (
    <AppShell title="Deck View">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-neutral-400">
            Ζωντανή εικόνα ημέρας
            {data?.as_of && (
              <span className="ml-2 font-mono text-neutral-500">
                · ενημέρωση {formatGRTime(data.as_of)}
              </span>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            data-testid="deck-refresh-btn"
            className="h-10 px-4 rounded-md text-sm font-bold bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-flame hover:text-white flex items-center gap-2"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Ανανέωση
          </button>
        </div>

        {error && !data && (
          <div className="p-4 mb-6 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF3B30]">
            {error}
          </div>
        )}

        {/* Checklist ημέρας — μικρή ένδειξη */}
        {data?.checklist &&
          (data.checklist.open.total > 0 || data.checklist.close.total > 0) && (
            <Link
              to="/app/checklist"
              data-testid="deck-checklist"
              className="inline-flex items-center gap-3 mb-5 px-4 py-2.5 bg-[#3D1620] border border-[#723645] rounded-lg hover:border-flame transition-colors"
            >
              <ListChecks className="w-4 h-4 text-flame" />
              {["open", "close"].map((lst) => {
                const c = data.checklist[lst];
                if (c.total === 0) return null;
                const full = c.done === c.total;
                return (
                  <span key={lst} className="text-sm font-semibold text-neutral-300">
                    {lst === "open" ? "Άνοιγμα" : "Κλείσιμο"}:{" "}
                    <span
                      className={`font-mono font-bold ${
                        full ? "text-[#00E676]" : "text-gold"
                      }`}
                      data-testid={`deck-checklist-${lst}`}
                    >
                      {c.done}/{c.total}
                    </span>
                  </span>
                );
              })}
            </Link>
          )}

        {/* Μεγάλα νούμερα ημέρας */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <BigCard
            icon={Euro}
            label="Τζίρος σήμερα"
            value={eur(data?.total_revenue ?? 0)}
            testId="deck-revenue"
          />
          <BigCard
            icon={ReceiptIcon}
            label="Παραγγελίες σήμερα"
            value={data?.total_orders ?? 0}
            testId="deck-orders"
          />
          <BigCard
            icon={TrendingUp}
            label="Μέση αξία"
            value={eur(data?.avg_order_value ?? 0)}
            sub="ανά παραγγελία"
            testId="deck-avg"
          />
          <BigCard
            icon={Wallet}
            label="Έξοδα σήμερα"
            value={eur(data?.total_expenses ?? 0)}
            testId="deck-expenses"
          />
          <BigCard
            icon={Scale}
            label="Καθαρό αποτέλεσμα"
            value={eur(net)}
            sub="τζίρος − έξοδα"
            valueClass={net >= 0 ? "text-[#00E676]" : "text-[#FF6961]"}
            iconClass={net >= 0 ? "text-[#00E676]" : "text-[#FF6961]"}
            testId="deck-net"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Τζίρος ανά πηγή */}
          <Panel icon={Euro} title="Τζίρος ανά πηγή" testId="deck-by-source">
            {(!data?.by_source || data.by_source.length === 0) ? (
              <div className="py-8 text-center text-neutral-500">
                Καμία παραγγελία σήμερα
              </div>
            ) : (
              <div className="space-y-2">
                {data.by_source
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((s) => (
                    <div
                      key={s.source}
                      className="flex items-center justify-between p-3 bg-[#2A0E14] border border-[#431A25] rounded-md"
                      data-testid={`deck-source-${s.source}`}
                    >
                      <span className="text-neutral-200 font-semibold">{s.source}</span>
                      <span className="font-mono text-white">
                        <span className="text-neutral-500 mr-2">{s.count} παρ.</span>
                        <span className="text-gold font-bold">{eur(s.revenue)}</span>
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          {/* Ανοιχτά τραπέζια */}
          <Panel
            icon={LayoutGrid}
            title={`Ανοιχτά τραπέζια (${data?.open_tables?.length ?? 0})`}
            testId="deck-open-tables"
          >
            {(!data?.open_tables || data.open_tables.length === 0) ? (
              <div className="py-8 text-center text-neutral-500">
                Κανένα ανοιχτό τραπέζι
              </div>
            ) : (
              <div className="space-y-2">
                {data.open_tables.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-[#2A0E14] border border-[#431A25] rounded-md"
                    data-testid={`deck-table-${t.table_name}`}
                  >
                    <div>
                      <div className="text-white font-semibold">{t.table_name}</div>
                      <div className="text-xs text-neutral-500">
                        {t.rounds_count} γύρο{t.rounds_count === 1 ? "ς" : "ι"}
                        {t.opened_at ? ` · από ${formatGRTime(t.opened_at)}` : ""}
                      </div>
                    </div>
                    <span className="font-mono text-gold font-bold">{eur(t.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Σε βάρδια τώρα */}
          <Panel icon={Users} title="Σε βάρδια τώρα" testId="deck-on-shift">
            {(!data?.on_shift || data.on_shift.length === 0) ? (
              <div className="py-8 text-center text-neutral-500">
                Κανείς βάσει προγράμματος
              </div>
            ) : (
              <div className="space-y-2">
                {data.on_shift.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-[#2A0E14] border border-[#431A25] rounded-md"
                    data-testid={`deck-shift-${p.name}`}
                  >
                    <span className="flex items-center gap-2 text-white font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                      {p.name}
                    </span>
                    <span className="font-mono text-neutral-400 text-sm">
                      {p.start}–{p.end}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </main>
    </AppShell>
  );
}
