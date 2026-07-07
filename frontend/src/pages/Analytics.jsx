import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Receipt as ReceiptIcon,
  Euro,
  TrendingUp,
  Clock,
  Award,
  RefreshCcw,
} from "lucide-react";
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

const COLORS = ["#FF6B00", "#00E676", "#FFB300", "#00B0FF", "#FF3B30"];

const StatCard = ({ icon: Icon, label, value, testId, sub }) => (
  <div
    className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        {label}
      </span>
      <Icon className="w-5 h-5 text-[#FF6B00]" />
    </div>
    <div className="font-mono text-3xl font-bold text-white mt-3">{value}</div>
    {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
  </div>
);

export default function Analytics() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const hourly = (data?.hourly || []).filter((h) => h.orders > 0);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="flex items-center justify-between px-6 h-16 border-b border-[#333]">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            data-testid="back-to-pda-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">Πίσω στο PDA</span>
          </Link>
          <h1 className="font-heading text-2xl font-bold" data-testid="analytics-title">
            Στατιστικά
          </h1>
        </div>
      </header>

      <main className="p-6 md:p-8 max-w-[1600px] mx-auto">
        {/* Filters */}
        <div className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Από
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-testid="date-from-input"
                className="h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Έως
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-testid="date-to-input"
                className="h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
            <Button
              onClick={load}
              disabled={loading}
              data-testid="apply-filter-btn"
              className="h-12 px-6 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold"
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
                  className="h-10 px-4 rounded-md text-sm font-bold border border-[#333] text-neutral-300 hover:border-[#FF6B00] hover:text-white"
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
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Hourly */}
          <div className="lg:col-span-2 p-5 bg-[#1A1A1A] border border-[#333] rounded-lg" data-testid="hourly-chart">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <h2 className="font-heading font-semibold text-lg">
                Παραγγελίες ανά ώρα
              </h2>
            </div>
            {hourly.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                Δεν υπάρχουν δεδομένα
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="label" stroke="#A3A3A3" fontSize={12} />
                  <YAxis stroke="#A3A3A3" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "#0D0D0D",
                      border: "1px solid #333",
                      borderRadius: 6,
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="orders" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By source */}
          <div className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg" data-testid="source-chart">
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
                        background: "#0D0D0D",
                        border: "1px solid #333",
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
        <div className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg" data-testid="popular-items">
          <h2 className="font-heading font-semibold text-lg mb-4">
            Δημοφιλέστερα προϊόντα
          </h2>
          {(!data?.popular_items || data.popular_items.length === 0) ? (
            <div className="py-8 text-center text-neutral-500">
              Δεν υπάρχουν δεδομένα για αυτό το διάστημα
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#333]">
                    <th className="py-3">#</th>
                    <th className="py-3">Προϊόν</th>
                    <th className="py-3 text-right">Τεμάχια</th>
                    <th className="py-3 text-right">Έσοδα</th>
                  </tr>
                </thead>
                <tbody>
                  {data.popular_items.map((it, i) => (
                    <tr
                      key={it.name}
                      className="border-b border-[#222] last:border-0"
                      data-testid={`popular-row-${i}`}
                    >
                      <td className="py-3 font-mono text-neutral-500">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="py-3 text-white font-medium">{it.name}</td>
                      <td className="py-3 text-right font-mono text-white">
                        {it.quantity}
                      </td>
                      <td className="py-3 text-right font-mono text-[#FF6B00] font-bold">
                        {eur(it.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
