import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Κοινό διάγραμμα πλήθους (παραγγελίες ανά ημέρα / ανά ώρα) με τα ίδια tokens
// με τα Στατιστικά του OrderDeck: κάρτα #3D1620, πλέγμα #4A1B27, μπάρες flame.
// data: [{ label, value }] · sub: δεύτερη γραμμή στο tooltip (προαιρετικά)
export default function CountBarChart({
  data,
  title,
  icon: Icon = null,
  height = 240,
  emptyText = "Δεν υπάρχουν δεδομένα",
  valueLabel = "Παραγγελίες",
  testId,
}) {
  const hasData = data?.some((d) => d.value > 0);
  return (
    <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg" data-testid={testId}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon className="w-4 h-4 text-flame" />}
          <h2 className="font-heading font-semibold text-lg">{title}</h2>
        </div>
      )}
      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-neutral-500 text-sm">
          {emptyText}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A1B27" />
            <XAxis dataKey="label" stroke="#A3A3A3" fontSize={12} interval="preserveStartEnd" />
            <YAxis stroke="#A3A3A3" fontSize={12} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#4A1B27", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="px-3 py-2 rounded-md border border-[#723645] bg-[#2A0E14] text-sm">
                    <div className="text-neutral-400 font-mono mb-1">{p.full || p.label}</div>
                    <div className="text-white font-mono">
                      {valueLabel}: {p.value}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="#F97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
