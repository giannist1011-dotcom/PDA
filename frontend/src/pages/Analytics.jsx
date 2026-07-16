import { useEffect, useState } from "react";
import {
  Receipt as ReceiptIcon,
  Euro,
  TrendingUp,
  Clock,
  Award,
  RefreshCcw,
  ArrowLeftRight,
  Wallet,
  Scale,
  ArrowUp,
  ArrowDown,
  Minus as MinusIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fetchAnalytics } from "@/lib/api";
import { eur, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";

const COLORS = ["#F97316", "#00E676", "#D4A017", "#00B0FF", "#FF3B30"];

const StatCard = ({ icon: Icon, label, value, testId, sub, valueClass = "text-white", iconClass = "text-flame" }) => (
  <div
    className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        {label}
      </span>
      <Icon className={`w-5 h-5 ${iconClass}`} />
    </div>
    <div className={`font-mono text-3xl font-bold mt-3 ${valueClass}`}>{value}</div>
    {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
  </div>
);

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

const pct = (a, b) => {
  if (!b || b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
};

const ChangeBadge = ({ value, testId }) => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "±";
  const cls =
    rounded > 0
      ? "text-[#00E676] bg-[#00E676]/10 border-[#00E676]/40"
      : rounded < 0
        ? "text-[#FF6961] bg-[#FF3B30]/10 border-[#FF3B30]/40"
        : "text-neutral-400 bg-[#3D1620] border-[#723645]";
  const Icon = rounded > 0 ? ArrowUp : rounded < 0 ? ArrowDown : MinusIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono font-bold ${cls}`}
      data-testid={testId}
    >
      <Icon className="w-3 h-3" />
      {sign}
      {rounded.toString().replace(".", ",")}%
    </span>
  );
};

const CompareCard = ({ label, valueA, valueB, format, testId }) => {
  const change = pct(valueB, valueA);
  return (
    <div
      className="p-4 md:p-5 bg-[#3D1620] border border-[#723645] rounded-lg"
      data-testid={testId}
    >
      <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-3">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Α</div>
          <div className="font-mono text-xl font-bold text-neutral-300 mt-0.5">
            {format(valueA)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-flame">Β</div>
          <div className="font-mono text-xl font-bold text-white mt-0.5">{format(valueB)}</div>
        </div>
      </div>
      <div className="mt-3">
        <ChangeBadge value={change} testId={`${testId}-change`} />
      </div>
    </div>
  );
};

export default function Analytics() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAnalytics(from, to);
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

  const setPreset = (preset) => {
    const now = new Date();
    const toDate = new Date(now);
    let fromDate = new Date(now);
    if (preset === "today") {
      // same day
    } else if (preset === "week") {
      fromDate.setDate(now.getDate() - 6);
    } else if (preset === "month") {
      fromDate.setDate(now.getDate() - 29);
    }
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setFrom(fmt(fromDate));
    setTo(fmt(toDate));
    setTimeout(load, 0);
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
        <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Από
              </label>
              <DatePicker
                value={from}
                onChange={setFrom}
                testId="date-from-input"
                className="h-12 px-3"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Έως
              </label>
              <DatePicker
                value={to}
                onChange={setTo}
                testId="date-to-input"
                className="h-12 px-3"
              />
            </div>
            <Button
              onClick={load}
              disabled={loading}
              data-testid="apply-filter-btn"
              className="h-12 px-6 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              {loading ? "Φόρτωση..." : "Εφαρμογή"}
            </Button>
            <div className="flex gap-2 ml-auto">
              {[
                { k: "today", label: "Σήμερα" },
                { k: "week", label: "7 μέρες" },
                { k: "month", label: "30 μέρες" },
              ].map((p) => (
                <button
                  key={p.k}
                  onClick={() => setPreset(p.k)}
                  data-testid={`preset-${p.k}`}
                  className="h-10 px-4 rounded-md text-sm font-bold bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-flame hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Hourly */}
          <div className="lg:col-span-2 p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="hourly-chart">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-flame" />
              <h2 className="font-heading font-semibold text-lg">
                Διάγραμμα ωρών
              </h2>
            </div>
            {hourly.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                Δεν υπάρχουν δεδομένα
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4A1B27" />
                  <XAxis dataKey="label" stroke="#A3A3A3" fontSize={12} />
                  <YAxis stroke="#A3A3A3" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#4A1B27", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="px-3 py-2 rounded-md border border-[#723645] bg-[#2A0E14] text-sm">
                          <div className="text-neutral-400 font-mono mb-1">{p.label}</div>
                          <div className="text-white font-mono">
                            Παραγγελίες: {p.orders} | Έσοδα: {eur(p.revenue)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="orders" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By source */}
          <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="source-chart">
            <h2 className="font-heading font-semibold text-lg mb-4">
              Ανά πηγή
            </h2>
            {(!data?.by_source || data.by_source.length === 0) ? (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                Δεν υπάρχουν δεδομένα
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.by_source}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {data.by_source.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#2A0E14",
                        border: "1px solid #723645",
                        borderRadius: 6,
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ color: "#A3A3A3", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {data.by_source.map((s, i) => (
                    <div
                      key={s.source}
                      className="flex justify-between text-sm"
                      data-testid={`source-row-${s.source}`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-neutral-300">{s.source}</span>
                      </span>
                      <span className="font-mono text-white">
                        {s.count} · {eur(s.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Popular items */}
        <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="popular-items">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <h2 className="font-heading font-semibold text-lg mr-auto">
              Δημοφιλέστερα προϊόντα
            </h2>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                Από
              </label>
              <DatePicker
                value={popFrom}
                onChange={setPopFrom}
                testId="popular-date-from"
                className="h-11 px-3 bg-[#2A0E14]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                Έως
              </label>
              <DatePicker
                value={popTo}
                onChange={setPopTo}
                testId="popular-date-to"
                className="h-11 px-3 bg-[#2A0E14]"
              />
            </div>
            <Button
              onClick={loadPopular}
              disabled={popLoading}
              data-testid="popular-apply-btn"
              className="h-11 px-5 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              {popLoading ? "Φόρτωση..." : "Εφαρμογή"}
            </Button>
          </div>
          {popError && (
            <div className="p-3 mb-4 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF6961] text-sm">
              {popError}
            </div>
          )}
          {(() => {
            const items = popItems ?? data?.popular_items ?? [];
            return items.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              Δεν υπάρχουν δεδομένα για αυτό το διάστημα
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#723645]">
                    <th className="py-3">#</th>
                    <th className="py-3">Προϊόν</th>
                    <th className="py-3 text-right">Τεμάχια</th>
                    <th className="py-3 text-right">Έσοδα</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr
                      key={it.name}
                      className="border-b border-[#431A25] last:border-0"
                      data-testid={`popular-row-${i}`}
                    >
                      <td className="py-3 font-mono text-neutral-500">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="py-3 text-white font-medium">{it.name}</td>
                      <td className="py-3 text-right font-mono text-white">
                        {it.quantity}
                      </td>
                      <td className="py-3 text-right font-mono text-gold font-bold">
                        {eur(it.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          })()}
        </div>

        {/* ---------- COMPARISON SECTION ---------- */}
        <div className="mt-8 p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="compare-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-xl font-semibold">Σύγκριση περιόδων</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-5">
            Συγκρίνετε δύο χρονικά διαστήματα δίπλα-δίπλα με ποσοστιαία μεταβολή
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">
            <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-md">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
                Περίοδος Α (προηγούμενη)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Από</label>
                  <DatePicker
                    value={cmpFromA}
                    onChange={setCmpFromA}
                    testId="compare-from-a"
                    className="w-full h-11 mt-1 bg-[#3D1620]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Έως</label>
                  <DatePicker
                    value={cmpToA}
                    onChange={setCmpToA}
                    testId="compare-to-a"
                    className="w-full h-11 mt-1 bg-[#3D1620]"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#2A0E14] border border-flame/40 rounded-md">
              <div className="text-xs font-bold uppercase tracking-widest text-flame mb-3">
                Περίοδος Β (τρέχουσα)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Από</label>
                  <DatePicker
                    value={cmpFromB}
                    onChange={setCmpFromB}
                    testId="compare-from-b"
                    className="w-full h-11 mt-1 bg-[#3D1620]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Έως</label>
                  <DatePicker
                    value={cmpToB}
                    onChange={setCmpToB}
                    testId="compare-to-b"
                    className="w-full h-11 mt-1 bg-[#3D1620]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              onClick={loadCompare}
              disabled={cmpLoading}
              data-testid="compare-run-btn"
              className="h-11 px-5 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              {cmpLoading ? "Υπολογισμός..." : "Σύγκριση"}
            </Button>
            {[
              { k: "yesterday-vs-today", label: "Χθες vs Σήμερα" },
              { k: "this-vs-last-week", label: "Αυτή vs Προηγ. εβδομάδα" },
              { k: "this-vs-last-month", label: "Αυτός vs Προηγ. μήνας" },
            ].map((p) => (
              <button
                key={p.k}
                onClick={() => applyComparePreset(p.k)}
                data-testid={`compare-preset-${p.k}`}
                className="h-11 px-4 rounded-md text-sm font-bold bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-flame hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>

          {cmpError && (
            <div className="p-3 mb-4 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF6961] text-sm">
              {cmpError}
            </div>
          )}

          {cmpDataA && cmpDataB ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <CompareCard
                  label="Έσοδα"
                  valueA={cmpDataA.total_revenue}
                  valueB={cmpDataB.total_revenue}
                  format={eur}
                  testId="cmp-card-revenue"
                />
                <CompareCard
                  label="Παραγγελίες"
                  valueA={cmpDataA.total_orders}
                  valueB={cmpDataB.total_orders}
                  format={(v) => String(v)}
                  testId="cmp-card-orders"
                />
                <CompareCard
                  label="Μέσος όρος"
                  valueA={cmpDataA.avg_order_value}
                  valueB={cmpDataB.avg_order_value}
                  format={eur}
                  testId="cmp-card-avg"
                />
              </div>

              <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-md" data-testid="cmp-by-source-table">
                <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
                  Παραγγελίες ανά πηγή
                </div>
                {bySourceMerged.length === 0 ? (
                  <div className="text-neutral-500 py-6 text-center">
                    Δεν υπάρχουν δεδομένα στα δύο διαστήματα
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs uppercase tracking-widest text-neutral-500 border-b border-[#431A25]">
                          <th className="py-2 text-left">Πηγή</th>
                          <th className="py-2 text-right">Α (Παρ.)</th>
                          <th className="py-2 text-right">Β (Παρ.)</th>
                          <th className="py-2 text-right">Μεταβολή</th>
                          <th className="py-2 text-right">Α (Έσοδα)</th>
                          <th className="py-2 text-right">Β (Έσοδα)</th>
                          <th className="py-2 text-right">Μεταβολή</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySourceMerged.map((row) => (
                          <tr
                            key={row.source}
                            className="border-b border-[#431A25] last:border-0"
                            data-testid={`cmp-source-row-${row.source}`}
                          >
                            <td className="py-3 font-semibold text-white">{row.source}</td>
                            <td className="py-3 text-right font-mono text-neutral-300">
                              {row.countA}
                            </td>
                            <td className="py-3 text-right font-mono text-white">{row.countB}</td>
                            <td className="py-3 text-right">
                              <ChangeBadge value={pct(row.countB, row.countA)} />
                            </td>
                            <td className="py-3 text-right font-mono text-neutral-300">
                              {eur(row.revenueA)}
                            </td>
                            <td className="py-3 text-right font-mono text-white">
                              {eur(row.revenueB)}
                            </td>
                            <td className="py-3 text-right">
                              <ChangeBadge value={pct(row.revenueB, row.revenueA)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-neutral-500 text-center py-8 text-sm">
              Επιλέξτε δύο περιόδους και πατήστε «Σύγκριση»
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
