import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { apiAdminResetDemoPassword, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Γραμμή credential με κουμπί αντιγραφής (κοινή με το CreateDemoModal)
export const CredRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2 text-sm py-1">
    <span className="text-neutral-400">{label}</span>
    {value ? (
      <span className="flex items-center gap-1.5 font-mono text-white">
        {value}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            toast.success("Αντιγράφηκε");
          }}
          className="p-1 rounded hover:bg-[#3D1620] text-neutral-400 hover:text-white"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </span>
    ) : (
      <span className="text-neutral-500">—</span>
    )}
  </div>
);

// Στοιχεία σύνδεσης demo λογαριασμού. Το backend στέλνει demo_credentials ΜΟΝΟ για
// demo λογαριασμούς και μόνο σε master/manage scope — εδώ απλώς τα εμφανίζουμε.
export default function DemoCredentials({ pw, accountId, email, credentials, onChanged }) {
  const [busy, setBusy] = useState(false);

  const resetPassword = async () => {
    setBusy(true);
    try {
      await apiAdminResetDemoPassword(pw, accountId);
      toast.success("Δημιουργήθηκε νέος κωδικός");
      onChanged();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-5 mt-5 p-4 bg-[#2A0E14] border border-gold/40 rounded-lg"
      data-testid="demo-credentials"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs uppercase tracking-widest font-bold text-gold flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> Στοιχεία σύνδεσης demo
        </div>
        <Button
          type="button"
          onClick={resetPassword}
          disabled={busy}
          data-testid="demo-reset-password"
          className="h-8 px-3 bg-[#3D1620] border border-[#723645] hover:border-gold text-gold text-xs font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset κωδικού
        </Button>
      </div>
      <CredRow label="Email" value={credentials?.email || email} />
      <CredRow label="Κωδικός" value={credentials?.password} />
      {!credentials?.password && (
        <p className="text-xs text-neutral-500 mt-1.5">
          Δεν υπάρχει αποθηκευμένος κωδικός (παλαιότερο demo) — κάντε «Reset κωδικού»
          για να δημιουργηθεί νέος.
        </p>
      )}
      {credentials?.drivers?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#723645]/40">
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">
            Demo οδηγοί (είσοδος οδηγού από κινητό)
          </div>
          {credentials.drivers.map((d) => (
            <div key={d.phone} className="py-1 border-b border-[#723645]/40 last:border-0">
              <div className="text-sm font-semibold">{d.name}</div>
              <CredRow label="Τηλέφωνο" value={d.phone} />
              <CredRow label="Κωδικός" value={d.password} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
