import { Search } from "lucide-react";
import { eur, formatGRDateTime } from "@/lib/format";

export default function CustomersTab({
  customerSearch,
  setCustomerSearch,
  customersLoading,
  filteredCustomers,
  customers,
  setSelectedCustomer,
}) {
  return (
    <>
      {/* Customers tab */}
      <div className="p-4 bg-[#3D1620] border border-[#723645] rounded-lg mb-5">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Αναζήτηση με όνομα, τηλέφωνο ή διεύθυνση..."
            data-testid="customer-search-input"
            className="w-full h-11 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
          />
        </div>
      </div>

      {customersLoading ? (
        <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
          {customers.length === 0
            ? "Δεν υπάρχουν πελάτες ακόμα — καταγράφονται αυτόματα από τις τηλεφωνικές παραγγελίες"
            : "Δεν βρέθηκαν πελάτες"}
        </div>
      ) : (
        <div className="overflow-x-auto bg-[#3D1620] border border-[#723645] rounded-lg">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#723645]">
                <th className="py-3 px-4">Πελάτης</th>
                <th className="py-3 px-4">Τηλέφωνο</th>
                <th className="py-3 px-4">Διεύθυνση</th>
                <th className="py-3 px-4 text-right">Παραγγελίες</th>
                <th className="py-3 px-4 text-right">Έσοδα</th>
                <th className="py-3 px-4 text-right">Τελευταία</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr
                  key={c.key}
                  onClick={() => setSelectedCustomer(c)}
                  data-testid={`customer-row-${c.key}`}
                  className="border-b border-[#431A25] last:border-0 cursor-pointer hover:bg-[#2A0E14] transition-colors"
                >
                  <td className="py-3 px-4 text-white font-semibold">
                    {c.name || <span className="text-neutral-500">Χωρίς όνομα</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-300">
                    {c.phone || "—"}
                  </td>
                  <td className="py-3 px-4 text-neutral-300 max-w-[240px] truncate">
                    {c.address ? `${c.address}${c.floor ? ` · ${c.floor}` : ""}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-gold">
                    {c.orders_count}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-white">
                    {eur(c.total_spent)}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-neutral-500 whitespace-nowrap">
                    {formatGRDateTime(c.last_order_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
