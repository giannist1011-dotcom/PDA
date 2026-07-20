import { useEffect, useState } from "react";
import {
  Receipt as ReceiptIcon,
  Euro,
  TrendingUp,
  Award,
  RefreshCcw,
  Wallet,
  Scale,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { fetchAnalytics } from "@/lib/api";
import { eur, todayISO } from "@/lib/format";
import { athensToday } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import PeriodFilter, { periodLabel } from "@/components/PeriodFilter";
import StatCard from "./analytics/StatCard";
import ChartsRow from "./analytics/ChartsRow";
import PopularItems from "./analytics/PopularItems";
import CompareSection from "./analytics/CompareSection";

// ---------- Comparison helpers ----------
const iso7DaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const isoNDaysBack = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function Analytics() {
  // Κύριο φίλτρο: κοινό pattern presets + custom εύρος (ημέρες Ελλάδας)
  const [period, setPeriod] = useState(() => {
    const t = athensToday();
    return { preset: "today", from: t, to: t };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Δημοφιλέστερα προϊόντα — δικό τους date range (ανεξάρτητο από το κύριο φίλτρο)
  const [popFrom, setPopFrom] = useState(todayISO());
  const [popTo, setPopTo] = useState(todayISO());
  const [popItems, setPopItems] = useState(null); // null → χρήση του κύριου range
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError] = useState(null);

  // Comparison state
  const [cmpFromA, setCmpFromA] = useState(isoNDaysBack(13));
  const [cmpToA, setCmpToA] = useState(isoNDaysBack(7));
  const [cmpFromB, setCmpFromB] = useState(iso7DaysAgo());
  const [cmpToB, setCmpToB] = useState(todayISO());
  const [cmpDataA, setCmpDataA] = useState(null);
  const [cmpDataB, setCmpDataB] = useState(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState(null);

  const load = async (f = period.from, t = period.to) => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAnalytics(f, t);
      setData(d);
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
      setCmpFromA(isoNDaysBack(13));
      setCmpToA(isoNDaysBack(7));
      setCmpFromB(isoNDaysBack(6));
      setCmpToB(todayISO());
    } else if (preset === "this-vs-last-month") {
      setCmpFromA(isoNDaysBack(59));
      setCmpToA(isoNDaysBack(30));
      setCmpFromB(isoNDaysBack(29));
      setCmpToB(todayISO());
    } else if (preset === "yesterday-vs-today") {
      setCmpFromA(isoNDaysBack(1));
      setCmpToA(isoNDaysBack(1));
      setCmpFromB(todayISO());
      setCmpToB(todayISO());
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
        </div>

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
      </main>
    </AppShell>
  );
}
