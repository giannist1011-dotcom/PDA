// Εκτύπωση με βάση τις ρυθμίσεις του λογαριασμού — δύο τρόποι:
//
// «Browser (kiosk)» (default): window.print() πάνω στο κρυφό #print-area.
// - Αντίγραφα: τα χειρίζεται το <Receipt /> (τυπώνει N σελίδες σε ΕΝΑ print job,
//   ώστε να δουλεύει και με silent/kiosk printing χωρίς extra dialogs).
// - Διπλή εκτύπωση (2ος εκτυπωτής): ο browser ΔΕΝ επιτρέπει επιλογή εκτυπωτή
//   προγραμματιστικά, οπότε ανοίγουμε δεύτερο print dialog — εκεί ο χρήστης
//   (ή το kiosk setup) στέλνει το job στον δεύτερο εκτυπωτή.
//
// «Print Bridge»: αντί για print dialog δημιουργείται print_job στο backend —
// η desktop εφαρμογή OrderDeck Print Bridge (στο PC του εκτυπωτή) το τυπώνει.
// Έτσι τυπώνουν και tablet/iPad/κινητά χωρίς συνδεδεμένο εκτυπωτή.
import { toast } from "sonner";
import { apiCreatePrintJob, apiOnboardingMarkPrint } from "@/lib/api";
import { receiptTexts, kitchenSlipText, zReportText } from "@/lib/receiptText";

const bridgeEnabled = (user) => user?.print_mode === "bridge";

const sendBridgeJob = (texts, kind) => {
  apiCreatePrintJob({ texts, kind }).catch(() => {
    toast.error("Η εκτύπωση δεν στάλθηκε στο Print Bridge — ελέγξτε τη σύνδεση");
  });
};

const browserPrint = (user) => {
  window.print();
  if (user?.print_double) {
    // Το window.print() είναι blocking όσο είναι ανοιχτό το dialog —
    // μικρή αναμονή ώστε να προλάβει να κλείσει πριν το δεύτερο.
    setTimeout(() => window.print(), 400);
  }
};

export function printReceiptJob(user, order = null) {
  // Onboarding: σημείωσε ότι έγινε εκτύπωση (fire-and-forget, δεν μπλοκάρει)
  apiOnboardingMarkPrint().catch(() => {});
  if (bridgeEnabled(user) && order) {
    sendBridgeJob(receiptTexts(order, user), "receipt");
    return;
  }
  browserPrint(user);
}

export function printKitchenSlip(user, slip) {
  apiOnboardingMarkPrint().catch(() => {});
  if (bridgeEnabled(user) && slip) {
    sendBridgeJob([kitchenSlipText(slip)], "kitchen");
    return;
  }
  window.print();
}

export function printZReport(user, report, restaurantName) {
  if (bridgeEnabled(user) && report) {
    sendBridgeJob([zReportText(report, restaurantName)], "zreport");
    return;
  }
  window.print();
}
