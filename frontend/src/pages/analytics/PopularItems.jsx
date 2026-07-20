import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { eur } from "@/lib/format";

export default function PopularItems({
  popFrom,
  setPopFrom,
  popTo,
  setPopTo,
  loadPopular,
  popLoading,
  popError,
  popItems,
  data,
}) {
  return (
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
  );
}
