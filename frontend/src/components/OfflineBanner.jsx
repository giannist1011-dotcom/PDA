import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { WifiOff, CloudUpload, RefreshCw } from "lucide-react";
import { useOfflineStatus, syncQueue, pingServer } from "@/lib/offline";

const RETRY_MS = 30 * 1000; // όσο υπάρχουν εκκρεμότητες, δοκίμασε ξανά κάθε 30"

// Banner κάτω από το header: "Εκτός σύνδεσης" + εκκρεμείς παραγγελίες προς συγχρονισμό.
// Αναλαμβάνει και το auto-sync: μόλις ο server ξαναγίνει προσβάσιμος, ανεβάζει την ουρά.
export default function OfflineBanner() {
  const { offline, pending, syncing } = useOfflineStatus();
  const prevPending = useRef(pending);

  // Auto-retry: όσο είμαστε offline ή έχουμε ουρά, δοκίμασε server + sync περιοδικά
  useEffect(() => {
    if (!offline && pending === 0) return undefined;
    const t = setInterval(async () => {
      const ok = await pingServer();
      if (ok && pending > 0) syncQueue();
    }, RETRY_MS);
    return () => clearInterval(t);
  }, [offline, pending]);

  // Μόλις επανέλθει η σύνδεση με εκκρεμότητες → άμεσο sync
  useEffect(() => {
    if (!offline && pending > 0 && !syncing) syncQueue();
  }, [offline, pending, syncing]);

  // Ειδοποίηση όταν αδειάσει η ουρά
  useEffect(() => {
    if (prevPending.current > 0 && pending === 0 && !offline) {
      toast.success(`Ο συγχρονισμός ολοκληρώθηκε — ${prevPending.current} παραγγελί${prevPending.current === 1 ? "α" : "ες"} ανέβηκ${prevPending.current === 1 ? "ε" : "αν"}`);
    }
    prevPending.current = pending;
  }, [pending, offline]);

  if (!offline && pending === 0) return null;

  return (
    <div
      data-testid="offline-banner"
      className={`shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 h-10 border-b text-xs sm:text-sm font-bold ${
        offline
          ? "bg-[#FF9500]/15 border-[#FF9500]/40 text-[#FFB340]"
          : "bg-[#00B0FF]/10 border-[#00B0FF]/40 text-[#00B0FF]"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {offline ? <WifiOff className="w-4 h-4 shrink-0" /> : <CloudUpload className="w-4 h-4 shrink-0" />}
        <span className="truncate">
          {offline
            ? "Εκτός σύνδεσης — οι παραγγελίες αποθηκεύονται τοπικά"
            : syncing
              ? "Συγχρονισμός παραγγελιών..."
              : "Σύνδεση OK — εκκρεμεί συγχρονισμός"}
        </span>
      </div>
      {pending > 0 && (
        <span className="shrink-0 flex items-center gap-1.5 font-mono" data-testid="offline-pending-count">
          {syncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {pending} σε αναμονή
        </span>
      )}
    </div>
  );
}
