import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Copy, Check, RefreshCcw, KeyRound } from "lucide-react";
import { useAuth } from "@/context/shared/AuthContext";
import {
  apiGetBridgeToken,
  apiRotateBridgeToken,
  apiCreatePrintJob,
  apiGetPrintJob,
  formatApiError,
} from "@/lib/api";
import { receiptTexts, sampleOrder } from "@/lib/receiptText";

// Το bridge θεωρείται «συνδεδεμένο» αν έκανε poll τα τελευταία 30"
const ONLINE_MS = 30 * 1000;

export default function BridgeSetup() {
  const { user } = useAuth();
  const [token, setToken] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try {
      const res = await apiGetBridgeToken();
      setToken(res.token || null);
      setLastSeen(res.last_seen || null);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const online = lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_MS;

  const generate = async () => {
    if (token && !window.confirm("Νέο token; Το παλιό θα πάψει να ισχύει και θα πρέπει να ενημερωθεί η εφαρμογή Print Bridge.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiRotateBridgeToken();
      setToken(res.token);
      setLastSeen(null);
      toast.success("Δημιουργήθηκε νέο token");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Αποτυχία αντιγραφής");
    }
  };

  const testPrint = async () => {
    setTesting(true);
    try {
      const job = await apiCreatePrintJob({
        texts: receiptTexts(sampleOrder(user), user),
        kind: "test",
      });
      // Περίμενε το bridge να το τυπώσει (poll ~12")
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await apiGetPrintJob(job.id);
        if (st.status === "printed") {
          toast.success("Η δοκιμαστική απόδειξη τυπώθηκε ✓");
          setTesting(false);
          return;
        }
        if (st.status === "failed") {
          toast.error(`Αποτυχία εκτύπωσης: ${st.error || "άγνωστο σφάλμα"}`);
          setTesting(false);
          return;
        }
      }
      toast.warning("Η εκτύπωση στάλθηκε αλλά το Print Bridge δεν απάντησε ακόμα — ελέγξτε ότι τρέχει στο PC του εκτυπωτή");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-neutral-500 px-4 py-3">Φόρτωση…</div>;
  }

  return (
    <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">Εφαρμογή OrderDeck Print Bridge</div>
          <div className="text-xs text-neutral-500">
            Τρέχει στο PC όπου είναι συνδεδεμένος ο θερμικός εκτυπωτής — τυπώνει τις
            παραγγελίες από όλες τις συσκευές (tablet, iPad, κινητά)
          </div>
        </div>
        <span
          data-testid="bridge-status"
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${
            online
              ? "text-green-400 border-green-500/50 bg-green-500/10"
              : "text-neutral-400 border-[#723645] bg-[#1d090e]"
          }`}
        >
          {online ? "● Συνδεδεμένο" : "○ Εκτός σύνδεσης"}
        </span>
      </div>

      <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal pl-4">
        <li>
          Εγκαταστήστε το <b>OrderDeckPrintBridge.exe</b> στο PC του εκτυπωτή (θα το λάβετε
          από την ομάδα του OrderDeck).
        </li>
        <li>Δημιουργήστε token εδώ και επικολλήστε το στις ρυθμίσεις της εφαρμογής.</li>
        <li>Επιλέξτε εκεί τον εκτυπωτή (π.χ. HPRT TP80N) και πατήστε δοκιμαστική εκτύπωση.</li>
      </ol>

      {token ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] bg-[#1d090e] border border-[#723645] rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
            {token}
          </code>
          <button
            onClick={copyToken}
            data-testid="bridge-copy-token"
            className="h-8 px-2 rounded-md border border-[#723645] hover:border-flame text-neutral-300"
            title="Αντιγραφή token"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="text-xs text-neutral-500">Δεν έχει δημιουργηθεί token ακόμα.</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={generate}
          disabled={busy}
          data-testid="bridge-generate-token"
          className="flex items-center gap-2 h-10 px-4 rounded-md border border-[#723645] hover:border-flame text-sm font-bold text-neutral-200 transition-colors"
        >
          <KeyRound className="w-4 h-4" /> {token ? "Νέο token" : "Δημιουργία token"}
        </button>
        <button
          onClick={load}
          data-testid="bridge-refresh"
          className="flex items-center gap-2 h-10 px-3 rounded-md border border-[#723645] hover:border-flame text-sm text-neutral-300 transition-colors"
          title="Ανανέωση κατάστασης"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
        {token && (
          <button
            onClick={testPrint}
            disabled={testing}
            data-testid="bridge-test-print"
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-flame/15 text-flame border border-flame/60 text-sm font-bold hover:bg-flame/25 transition-colors disabled:opacity-60"
          >
            <Printer className="w-4 h-4" /> {testing ? "Εκτύπωση…" : "Δοκιμαστική εκτύπωση"}
          </button>
        )}
      </div>
    </div>
  );
}
