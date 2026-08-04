import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt as ReceiptIcon,
  Euro,
  TrendingUp,
  Award,
  RefreshCcw,
  Wallet,
  Scale,
} from "lucide-react";
import AppShell from "@/components/shared/AppShell";
import { fetchAnalytics, fetchAnalyticsYoY } from "@/lib/api";
import { eur } from "@/lib/format";
import { useBusinessDay } from "@/lib/businessDay";
import { Button } from "@/components/ui/button";
import PeriodFilter, { periodLabel } from "@/components/shared/PeriodFilter";
import StatCard from "@/components/shared/StatCard";
import SourceFilter from "@/components/pos/SourceFilter";
import SourceMix from "@/components/pos/SourceMix";
import { usePlatformOrders } from "@/context/platforms/PlatformOrdersContext";
import ChartsRow from "./analytics/ChartsRow";
import PopularItems from "./analytics/PopularItems";
import CompareSection from "./analytics/CompareSection";
import YoYSection from "./analytics/YoYSection";
import AddressHeatmap from "./analytics/AddressHeatmap";

// ---------- Comparison helpers ----------
// base = εργάσιμη «σήμερα» του μαγαζιού (όχι ημερολογιακή/συσκευής)
const isoNDaysBack = (n, base) => {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function Analytics() {
  // Οι ημέρες των στατιστικών είναι ΕΡΓΑΣΙΜΕΣ (ωράριο μαγαζιού) — ίδιο όριο με το Z
  const { today: bizToday } = useBusinessDay();
  // Κύριο φίλτρο: κοινό pattern presets + custom εύρος
  const [period, setPeriod] = useState(() => ({
    preset: "today",
    from: bizToday,
    to: bizToday,
  }));
  const [data, setData] = useState(null);
  const [yoy, setYoy] = useState(null); // σύγκριση με πέρσι για το ίδιο εύρος
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Προέλευση: «Όλα» (all-around) ή μία πηγή — έρχεται και ως ?source= από την
  // καρτέλα της πλατφόρμας («Στατιστικά efood»)
  const { enabled: enabledPlatforms } = usePlatformOrders();
  const [searchParams] = useSearchParams();
  const [source, setSource] = useState(() => searchParams.get("source") || "all");

  // Δημοφιλέστερα προϊόντα — δικό τους date range (ανεξάρτητο από το κύριο φίλτρο)
  const [popFrom, setPopFrom] = useState(bizToday);
  const [popTo, setPopTo] = useState(bizToday);
  const [popItems, setPopItems] = useState(null); // null → χρήση του κύριου range
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError] = useState(null);

  // Comparison state
  const [cmpFromA, setCmpFromA] = useState(() => isoNDaysBack(13, bizToday));
  const [cmpToA, setCmpToA] = useState(() => isoNDaysBack(7, bizToday));
  const [cmpFromB, setCmpFromB] = useState(() => isoNDaysBack(6, bizToday));
  const [cmpToB, setCmpToB] = useState(bizToday);
  const [cmpDataA, setCmpDataA] = useState(null);
  const [cmpDataB, setCmpDataB] = useState(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState(null);

  const load = async (f = period.from, t = period.to, src = source) => {
    setLoading(true);
    setError(null);
    try {
      const [d, y] = await Promise.all([
        fetchAnalytics(f, t, src),
        fetchAnalyticsYoY(f, t).catch(() => null), // η σύγκριση δεν μπλοκάρει τα βασικά
      ]);
      setData(d);
      setYoy(y);
    } catch (e) {
      setError("Σφάλμα φόρτωσης");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preset → άμεση εφαρμογή· custom ημερομηνία → πατάει «Εφαρμογή»
  const handlePeriodChange = (next, meta) => {
    setPeriod(next);
    if (meta.fromPreset) load(next.from, next.to);
  };

  // Αλλαγή προέλευσης → άμεση επαναφόρτωση με το ίδιο εύρος
  const handleSourceChange = (next) => {
    setSource(next);
    load(period.from, period.to, next);
  };

  // Μία μπάρα ανά ώρα — κρατάμε το συνεχόμενο παράθυρο από την πρώτη έως την
  // τελευταία ώρα με παραγγελίες (οι ενδιάμεσες νεκρές ώρες φαίνονται ως κενές).
  const hourly = (() => {
    const all = data?.hourly || [];
    const first = all.findIndex((h) => h.orders > 0);
    if (first === -1) return [];
    let last = all.length - 1;
    while (last > first && all[last].orders === 0) last--;
    return all.slice(first, last + 1);
  })();

  const loadPopular = async () => {
    setPopLoading(true);
    setPopError(null);
    try {
      const d = await fetchAnalytics(popFrom, popTo);
      setPopItems(d.popular_items || []);
    } catch (e) {
      setPopError("Σφάλμα φόρτωσης");
    } finally {
      setPopLoading(false);
    }
  };

  const loadCompare = async () => {
    setCmpLoading(true);
    setCmpError(null);
    try {
      const [a, b] = await Promise.all([
        fetchAnalytics(cmpFromA, cmpToA),
        fetchAnalytics(cmpFromB, cmpToB),
      ]);
      setCmpDataA(a);
      setCmpDataB(b);
    } catch (e) {
      setCmpError("Σφάλμα φόρτωσης σύγκρισης");
    } finally {
      setCmpLoading(false);
    }
  };

  const applyComparePreset = (preset) => {
    if (preset === "this-vs-last-week") {
      setCmpFromA(isoNDaysBack(13, bizToday));
      setCmpToA(isoNDaysBack(7, bizToday));
      setCmpFromB(isoNDaysBack(6, bizToday));
      setCmpToB(bizToday);
    } else if (preset === "this-vs-last-month") {
      setCmpFromA(isoNDaysBack(59, bizToday));
      setCmpToA(isoNDaysBack(30, bizToday));
      setCmpFromB(isoNDaysBack(29, bizToday));
      setCmpToB(bizToday);
    } else if (preset === "yesterday-vs-today") {
      setCmpFromA(isoNDaysBack(1, bizToday));
      setCmpToA(isoNDaysBack(1, bizToday));
      setCmpFromB(bizToday);
      setCmpToB(bizToday);
    }
    setTimeout(loadCompare, 0);
  };

  // Merge by-source for comparison
  const bySourceMerged = (() => {
    if (!cmpDataA || !cmpDataB) return [];
    const map = new Map();
    (cmpDataA.by_source || []).forEach((s) => map.set(s.source, { A: s, B: null }));
    (cmpDataB.by_source || []).forEach((s) => {
      const cur = map.get(s.source) || { A: null, B: null };
      cur.B = s;
      map.set(s.source, cur);
    });
    return Array.from(map.entries()).map(([source, v]) => ({
      source,
      countA: v.A?.count || 0,
      countB: v.B?.count || 0,
      revenueA: v.A?.revenue || 0,
      revenueB: v.B?.revenue || 0,
    }));
  })();

  return (
    <AppShell title="Στατιστικά">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        {/* Filters */}
        <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <PeriodFilter
              value={period}
              onChange={handlePeriodChange}
              testIdPrefix="analytics"
              today={bizToday}
            />
            <Button
              onClick={() => load()}
              disabled={loading}
              data-testid="apply-filter-btn"
              className="h-11 px-6 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              {loading ? "Φόρτωση..." : "Εφαρμογή"}
            </Button>
          </div>
          <SourceFilter
            value={source}
            onChange={handleSourceChange}
            enabledPlatforms={enabledPlatforms}
            testIdPrefix="analytics-source"
          />
          <div className="pt-3 border-t border-[#431A25] text-sm text-neutral-300">
            Εύρος:{" "}
            <span className="font-mono font-bold text-white" data-testid="analytics-period-label">
              {periodLabel(period)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF3B30]">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={ReceiptIcon}
            label="Παραγγελίες"
            value={data?.total_orders ?? 0}
            testId="stat-total-orders"
          />
          <StatCard
            icon={Euro}
            label="Έσοδα"
            value={eur(data?.total_revenue ?? 0)}
            testId="stat-total-revenue"
          />
          <StatCard
            icon={TrendingUp}
            label="Μέσος όρος"
            value={eur(data?.avg_order_value ?? 0)}
            testId="stat-avg-order"
            sub="ανά παραγγελία"
          />
          <StatCard
            icon={Award}
            label="Δημοφιλέστερο"
            value={data?.popular_items?.[0]?.name || "—"}
            testId="stat-top-item"
            sub={
              data?.popular_items?.[0]
                ? `${data.popular_items[0].quantity} τεμ.`
                : ""
            }
          />
          {/* Τα έξοδα δεν μερίζονται ανά προέλευση — μόνο στην προβολή «Όλα» */}
          {data?.has_expenses !== false && (
            <>
              <StatCard
                icon={Wallet}
                label="Έξοδα"
                value={eur(data?.total_expenses ?? 0)}
                testId="stat-total-expenses"
                sub="της περιόδου"
              />
              <StatCard
                icon={Scale}
                label="Καθαρό αποτέλεσμα"
                value={eur(data?.net_result ?? 0)}
                testId="stat-net-result"
                sub="έσοδα − έξοδα"
                valueClass={(data?.net_result ?? 0) >= 0 ? "text-[#00E676]" : "text-[#FF6961]"}
                iconClass={(data?.net_result ?? 0) >= 0 ? "text-[#00E676]" : "text-[#FF6961]"}
              />
            </>
          )}
        </div>

        {/* Μείγμα προέλευσης — μόνο στην all-around προβολή */}
        {source === "all" && (
          <div className="mb-6">
            <SourceMix mix={data?.source_mix} />
          </div>
        )}

        {/* Σύγκριση με πέρσι (ίδια περίοδος πριν 1 έτος) */}
        <YoYSection yoy={yoy} />

        {/* Charts row */}
        <ChartsRow hourly={hourly} data={data} />

        {/* Popular items */}
        <PopularItems
          popFrom={popFrom}
          setPopFrom={setPopFrom}
          popTo={popTo}
          setPopTo={setPopTo}
          loadPopular={loadPopular}
          popLoading={popLoading}
          popError={popError}
          popItems={popItems}
          data={data}
        />

        {/* ---------- COMPARISON SECTION ---------- */}
        <CompareSection
          cmpFromA={cmpFromA}
          setCmpFromA={setCmpFromA}
          cmpToA={cmpToA}
          setCmpToA={setCmpToA}
          cmpFromB={cmpFromB}
          setCmpFromB={setCmpFromB}
          cmpToB={cmpToB}
          setCmpToB={setCmpToB}
          cmpLoading={cmpLoading}
          cmpError={cmpError}
          cmpDataA={cmpDataA}
          cmpDataB={cmpDataB}
          loadCompare={loadCompare}
          applyComparePreset={applyComparePreset}
          bySourceMerged={bySourceMerged}
        />

        {/* Heatmap διευθύνσεων παράδοσης */}
        <AddressHeatmap />
      </main>
    </AppShell>
  );
}
