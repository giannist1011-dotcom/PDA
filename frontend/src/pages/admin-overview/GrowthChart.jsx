import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// Νέοι λογαριασμοί ανά εβδομάδα (12 εβδομάδες) — stacked μαγαζιά/εταιρίες,
// ίδιο recharts στήσιμο με τα analytics των μαγαζιών (demo εκτός).
export default function GrowthChart({ growth }) {
  const empty = !growth?.some((w) => w.stores || w.companies);
  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4" data-testid="growth-chart">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 mb-4">
        <TrendingUp className="w-4 h-4 text-flame" /> Νέοι λογαριασμοί ανά εβδομάδα
      </div>
      {empty ? (
        <div className="h-56 flex items-center justify-center text-neutral-500 text-sm">
          Καμία νέα εγγραφή τις τελευταίες 12 εβδομάδες
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={growth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A1B27" />
            <XAxis dataKey="week" stroke="#A3A3A3" fontSize={11} />
            <YAxis stroke="#A3A3A3" fontSize={12} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#4A1B27", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="px-3 py-2 rounded-md border border-[#723645] bg-[#2A0E14] text-sm">
                    <div className="text-neutral-400 font-mono mb-1">Εβδ. {p.week}</div>
                    <div className="text-white font-mono">
                      Μαγαζιά: {p.stores} | Εταιρίες: {p.companies}
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ color: "#A3A3A3", fontSize: 12 }} />
            <Bar dataKey="stores" name="Μαγαζιά" stackId="a" fill="#F97316" />
            <Bar dataKey="companies" name="Εταιρίες" stackId="a" fill="#D4A017" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
