import { Clock } from "lucide-react";
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
import { eur } from "@/lib/format";

const COLORS = ["#F97316", "#00E676", "#D4A017", "#00B0FF", "#FF3B30"];

export default function ChartsRow({ hourly, data }) {
  return (
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
  );
}
