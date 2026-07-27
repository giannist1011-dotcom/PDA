import { useState } from "react";
import { toast } from "sonner";
import { Handshake, Check, X } from "lucide-react";
import { apiFleetRespondPartnership } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";

// Εκκρεμή αιτήματα συνεργασίας καταστημάτων (FleetDeck καταστήματος) στον πίνακα
// της εταιρείας: αποδοχή → ενεργή συνεργασία, το κατάστημα ανεβάζει παραγγελίες.
// Τα δεδομένα έρχονται με το polling του board — εμφανίζεται μόνο όταν υπάρχουν.
export default function PartnershipRequests({ requests, onChanged }) {
  const [busyId, setBusyId] = useState(null);

  if (!requests?.length) return null;

  const respond = async (req, accept) => {
    if (
      !accept &&
      !window.confirm(`Απόρριψη του αιτήματος συνεργασίας από «${req.store_name}»;`)
    )
      return;
    setBusyId(req.id);
    try {
      await apiFleetRespondPartnership(req.id, accept);
      toast.success(
        accept
          ? `Ενεργή συνεργασία με «${req.store_name}»`
          : "Το αίτημα απορρίφθηκε"
      );
      onChanged();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="bg-[#3D1620] border border-gold/50 rounded-lg p-4"
      data-testid="fleet-partnership-requests"
    >
      <div className="flex items-center gap-2 font-heading font-bold mb-3">
        <Handshake className="w-4 h-4 text-gold" />
        Αιτήματα συνεργασίας ({requests.length})
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center gap-3 p-3 bg-[#2A0E14] border border-[#723645] rounded-lg"
            data-testid={`fleet-partnership-req-${req.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{req.store_name}</div>
              <div className="text-xs text-neutral-400 truncate">
                {req.store_city || "—"} · θέλει να ανεβάζει παραγγελίες στους οδηγούς σας
              </div>
            </div>
            <button
              disabled={busyId === req.id}
              onClick={() => respond(req, true)}
              data-testid={`fleet-partnership-accept-${req.id}`}
              className="h-9 px-3 rounded-md bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-4 h-4" /> Αποδοχή
            </button>
            <button
              disabled={busyId === req.id}
              onClick={() => respond(req, false)}
              data-testid={`fleet-partnership-decline-${req.id}`}
              className="h-9 px-3 rounded-md border border-[#723645] text-neutral-300 text-xs font-bold flex items-center gap-1.5 hover:bg-white/5 disabled:opacity-60"
            >
              <X className="w-4 h-4" /> Απόρριψη
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
