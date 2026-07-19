import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, RefreshCw } from "lucide-react";
import { apiAdminExpiringSubs, formatApiError } from "@/lib/api";
import { businessLabel } from "@/lib/business";
import { formatGRDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import AdminShell, { useAdminPw } from "@/components/AdminShell";
import { PLAN_LABELS, PAYMENT_LABELS, StatusBadge } from "@/pages/AdminShops";

const PAYMENT_BADGE = {
  paid: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-gold/15 text-gold",
  expired: "bg-[#FF3B30]/15 text-[#FF6961]",
};

function daysLeft(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function SubsContent() {
  const pw = useAdminPw();
  const [shops, setShops] = useState(null);

  const load = useCallback(() => {
    apiAdminExpiringSubs(pw)
      .then(setShops)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw]);

  useEffect(() => {
    load();
  }, [load]);

  if (!shops) return <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-flame" />
          Συνδρομές και δοκιμές που λήγουν στις επόμενες 7 ημέρες — για follow-up.
        </p>
        <Button
          type="button"
          onClick={load}
          data-testid="subs-refresh"
          className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-neutral-500">
        Η επεξεργασία πλάνου, λήξης και κατάστασης πληρωμής γίνεται από την καρτέλα κάθε
        μαγαζιού (ενότητα «Μαγαζιά»).
      </p>

      {shops.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Καμία συνδρομή δεν λήγει τις επόμενες 7 ημέρες.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="subs-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Μαγαζί</th>
                <th className="px-3 py-2.5 font-bold">Τύπος</th>
                <th className="px-3 py-2.5 font-bold">Πλάνο</th>
                <th className="px-3 py-2.5 font-bold">Λήξη</th>
                <th className="px-3 py-2.5 font-bold">Πληρωμή</th>
                <th className="px-3 py-2.5 font-bold">Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => {
                const dl = daysLeft(s.subscription_expires_at);
                return (
                  <tr key={s.id} className="border-t border-[#723645]/50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{s.restaurant_name}</div>
                      <div className="text-xs text-neutral-500">{s.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-300">{businessLabel(s.business_type)}</td>
                    <td className="px-3 py-2.5 text-neutral-300">{PLAN_LABELS[s.plan] || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold">{formatGRDate(s.subscription_expires_at)}</span>
                      {dl != null && (
                        <span className={`ml-2 text-xs ${dl <= 2 ? "text-[#FF6961]" : "text-neutral-500"}`}>
                          {dl === 0 ? "σήμερα" : dl === 1 ? "αύριο" : `σε ${dl} ημέρες`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          PAYMENT_BADGE[s.payment_status] || "bg-neutral-500/15 text-neutral-400"
                        }`}
                      >
                        {PAYMENT_LABELS[s.payment_status] || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminSubscriptions() {
  return (
    <AdminShell title="Συνδρομές" subtitle="Λήγουν σύντομα (7 ημέρες)">
      <SubsContent />
    </AdminShell>
  );
}
