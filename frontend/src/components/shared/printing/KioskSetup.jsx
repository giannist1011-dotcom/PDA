import { useState } from "react";
import { toast } from "sonner";
import { Printer, Copy, Check } from "lucide-react";
import Receipt from "@/components/pos/Receipt";
import { useAuth } from "@/context/shared/AuthContext";
import { sampleOrder } from "@/lib/receiptText";

const KIOSK_CMD = 'chrome.exe --kiosk-printing --app=' + window.location.origin + '/app';

// Οδηγίες & δοκιμή για τη λειτουργία «Browser (kiosk)» — αθόρυβη εκτύπωση
// στον προεπιλεγμένο εκτυπωτή των Windows μέσω Chrome --kiosk-printing.
export default function KioskSetup() {
  const { user } = useAuth();
  const [testOrder, setTestOrder] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(KIOSK_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Αποτυχία αντιγραφής");
    }
  };

  const testPrint = () => {
    setTestOrder(sampleOrder(user));
    // μικρή αναμονή να μπει το δείγμα στο #print-area πριν το print
    setTimeout(() => {
      window.print();
      setTimeout(() => setTestOrder(null), 500);
    }, 150);
  };

  return (
    <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-3">
      <div>
        <div className="font-semibold text-sm">Ρύθμιση αθόρυβης εκτύπωσης (kiosk)</div>
        <div className="text-xs text-neutral-500">
          Για εκτύπωση χωρίς κανένα παράθυρο διαλόγου στο PC του ταμείου
        </div>
      </div>
      <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal pl-4">
        <li>
          Ορίστε τον θερμικό εκτυπωτή (π.χ. HPRT TP80N) ως <b>προεπιλεγμένο εκτυπωτή</b> στα
          Windows, με χαρτί <b>80mm</b> και περιθώρια 0.
        </li>
        <li>
          Ανοίγετε την εφαρμογή ΠΑΝΤΑ μέσω Chrome με τη σημαία <code>--kiosk-printing</code> —
          φτιάξτε συντόμευση με γραμμή εντολής:
        </li>
      </ol>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] bg-[#1d090e] border border-[#723645] rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
          {KIOSK_CMD}
        </code>
        <button
          onClick={copyCmd}
          data-testid="kiosk-copy-cmd"
          className="h-8 px-2 rounded-md border border-[#723645] hover:border-flame text-neutral-300"
          title="Αντιγραφή"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="text-xs text-neutral-500">
        Με αυτή τη ρύθμιση κάθε παραγγελία τυπώνεται αμέσως στον προεπιλεγμένο εκτυπωτή, χωρίς
        παράθυρα. Χωρίς kiosk mode ανοίγει το κανονικό παράθυρο εκτύπωσης του browser.
      </div>
      <button
        onClick={testPrint}
        data-testid="kiosk-test-print"
        className="flex items-center gap-2 h-10 px-4 rounded-md bg-flame/15 text-flame border border-flame/60 text-sm font-bold hover:bg-flame/25 transition-colors"
      >
        <Printer className="w-4 h-4" /> Δοκιμαστική εκτύπωση
      </button>
      {testOrder && <Receipt order={testOrder} />}
    </div>
  );
}
