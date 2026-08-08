import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Handshake, Send, Truck, XCircle } from "lucide-react";
import AppShell from "@/components/shared/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import SectionHeader from "@/components/shared/SectionHeader";
import {
  apiStoreFleetCompanies,
  apiStoreFleetEndPartnership,
  apiStoreFleetRequestPartner,
  formatApiError,
} from "@/lib/api";

// Ετικέτες κατάστασης αιτήματος ανά εταιρεία (null = χωρίς αίτημα)
const STATUS_BADGES = {
  pending: { label: "Σε εκκρεμότητα", cls: "bg-gold/10 text-gold border-gold/40" },
  active: { label: "Ενεργή συνεργασία", cls: "bg-[#34C759]/10 text-[#5BD778] border-[#34C759]/40" },
  declined: { label: "Απορρίφθηκε", cls: "bg-[#FF3B30]/10 text-[#FF6961] border-[#FF3B30]/40" },
};

// «Αίτημα συνεργασίας» (FleetDeck καταστήματος, μόνο Ιδιοκτήτης): εταιρείες
// διανομής που καλύπτουν την πόλη του καταστήματος + αποστολή αιτήματος, και
// οι ενεργές συνεργασίες με δυνατότητα τερματισμού.
export default function StoreFleetPartners() {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    apiStoreFleetCompanies().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const request = async (team) => {
    setBusyId(team.id);
    try {
      await apiStoreFleetRequestPartner(team.id);
      toast.success(`Το αίτημα στάλθηκε στην «${team.name}»`);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const endPartnership = async (p) => {
    if (!window.confirm(`Τερματισμός της συνεργασίας με «${p.team_name}»;`)) return;
    setBusyId(p.id);
    try {
      await apiStoreFleetEndPartnership(p.id);
      toast.success("Η συνεργασία τερματίστηκε");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const companies = data?.companies || [];
  const activeParts = data?.active || [];

  return (
    <AppShell title="Αίτημα συνεργασίας">
      <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full">
        {/* Ενεργές συνεργασίες — με «Τερματισμός» */}
        <section>
          <SectionHeader
            icon={Handshake}
            title={`Ενεργές συνεργασίες (${activeParts.length})`}
            size="sm"
          />
          {activeParts.length === 0 ? (
            <EmptyState text="Καμία ενεργή συνεργασία — στείλτε αίτημα σε μια εταιρεία παρακάτω" />
          ) : (
            <div className="space-y-2">
              {activeParts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 bg-[#3D1620] border border-[#723645] rounded-lg"
                  data-testid={`store-fleet-partnership-${p.id}`}
                >
                  <Truck className="w-5 h-5 text-flame shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.team_name}</div>
                    <div className="text-xs text-neutral-400">{p.team_city || "—"}</div>
                  </div>
                  <button
                    disabled={busyId === p.id}
                    onClick={() => endPartnership(p)}
                    data-testid={`store-fleet-end-${p.id}`}
                    className="h-9 px-3 rounded-md border border-[#723645] text-[#FF6961] text-xs font-bold flex items-center gap-1.5 hover:bg-[#FF3B30]/10 hover:border-[#FF3B30]/50 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" /> Τερματισμός
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Διαθέσιμες εταιρείες στην πόλη του καταστήματος */}
        <section>
          <SectionHeader
            icon={Truck}
            title={`Εταιρείες delivery${data?.store_city ? ` στην πόλη «${data.store_city}»` : ""}`}
            subtitle="Με την αποδοχή του αιτήματος από την εταιρεία, μπορείτε να της ανεβάζετε παραγγελίες. Ένα κατάστημα μπορεί να έχει πολλές ενεργές συνεργασίες."
            size="sm"
          />
          {companies.length === 0 ? (
            <EmptyState text="Δεν βρέθηκαν εταιρείες διανομής για την πόλη σας ακόμα" />
          ) : (
            <div className="space-y-2">
              {companies.map((c) => {
                const badge = STATUS_BADGES[c.partnership_status];
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-3 bg-[#3D1620] border border-[#723645] rounded-lg"
                    data-testid={`store-fleet-company-${c.id}`}
                  >
                    <Truck className="w-5 h-5 text-neutral-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-neutral-400">{c.city || "—"}</div>
                    </div>
                    {badge && (
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    )}
                    {(!c.partnership_status || c.partnership_status === "declined") && (
                      <button
                        disabled={busyId === c.id}
                        onClick={() => request(c)}
                        data-testid={`store-fleet-request-${c.id}`}
                        className="h-9 px-3 rounded-md bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Send className="w-4 h-4" /> Αποστολή αιτήματος
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
