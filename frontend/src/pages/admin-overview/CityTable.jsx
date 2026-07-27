import { useState } from "react";
import { Table2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// Πίνακας πόλεων κάτω από τον χάρτη — ίδια νούμερα με τα popups, ταξινομήσιμος.
const COLS = [
  { key: "name", label: "Πόλη", left: true },
  { key: "orderdeck", label: "OrderDeck" },
  { key: "fleet", label: "FleetDeck" },
  { key: "orderdeck_fleet", label: "OD Fleet" },
  { key: "companies", label: "Εταιρίες" },
  { key: "demo", label: "Demo" },
  { key: "total", label: "Σύνολο" },
];

const rowValue = (c, key) => {
  if (key === "name") return c.name;
  if (key === "companies" || key === "demo") return c[key] || 0;
  if (key === "total")
    return (
      Object.values(c.stores || {}).reduce((s, n) => s + n, 0) + (c.companies || 0)
    );
  return c.stores?.[key] || 0;
};

export default function CityTable({ cities }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });

  const toggle = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === "name" ? 1 : -1 }));

  const sorted = [...(cities || [])].sort((a, b) => {
    const va = rowValue(a, sort.key);
    const vb = rowValue(b, sort.key);
    const cmp =
      typeof va === "string" ? va.localeCompare(vb, "el") : (va || 0) - (vb || 0);
    return cmp * sort.dir;
  });

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4" data-testid="city-table">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">
        <Table2 className="w-4 h-4 text-flame" /> Πόλεις
      </div>
      {!sorted.length ? (
        <div className="text-sm text-neutral-500 py-6 text-center">
          Καμία πόλη ακόμα — θα εμφανιστούν με τις πρώτες εγγραφές.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-400 border-b border-[#723645]">
                {COLS.map((col) => {
                  const active = sort.key === col.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                  return (
                    <th key={col.key} className={`py-2 px-2 ${col.left ? "text-left" : "text-right"}`}>
                      <button
                        type="button"
                        onClick={() => toggle(col.key)}
                        data-testid={`city-sort-${col.key}`}
                        className={`inline-flex items-center gap-1 font-semibold hover:text-white transition-colors ${
                          active ? "text-white" : ""
                        }`}
                      >
                        {col.label} <Icon className="w-3 h-3" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.name} className="border-b border-[#4A1B27] hover:bg-[#2A0E14]">
                  <td className="py-2 px-2 font-semibold text-white">{c.name}</td>
                  {COLS.slice(1).map((col) => (
                    <td key={col.key} className="py-2 px-2 text-right font-mono text-neutral-300">
                      {rowValue(c, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
