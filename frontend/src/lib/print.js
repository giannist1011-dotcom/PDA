// Εκτύπωση με βάση τις ρυθμίσεις του λογαριασμού — τρεις τρόποι:
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
//
// «Kiosk Relay»: σαν το Bridge αλλά ΧΩΡΙΣ desktop εφαρμογή — σταθμός εκτύπωσης
// είναι το ίδιο το web app στο kiosk PC (RelayAgent στο AppShell): κάνει poll τα
// jobs και τα τυπώνει αθόρυβα. Η συσκευή-σταθμός τυπώνει απευθείας (χωρίς job)·
// οι υπόλοιπες στέλνουν job με δομημένο payload για πανομοιότυπη εκτύπωση.
import { toast } from "sonner";
import { apiCreatePrintJob, apiOnboardingMarkPrint } from "@/lib/api";
import { receiptTexts, kitchenSlipText, zReportText } from "@/lib/receiptText";
import { isRelayStation } from "@/lib/relayStation";

const bridgeEnabled = (user) => user?.print_mode === "bridge";
// Relay: μόνο οι ΑΛΛΕΣ συσκευές στέλνουν job — ο σταθμός τυπώνει απευθείας
const relayJobEnabled = (user) => user?.print_mode === "kiosk_relay" && !isRelayStation();

const sendJob = (texts, kind, payload, viaRelay) => {
  apiCreatePrintJob({ texts, kind, payload }).catch(() => {
    toast.error(
      viaRelay
        ? "Η εκτύπωση δεν στάλθηκε στον σταθμό εκτύπωσης — ελέγξτε τη σύνδεση"
        : "Η εκτύπωση δεν στάλθηκε στο Print Bridge — ελέγξτε τη σύνδεση"
    );
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
  if (order && (bridgeEnabled(user) || relayJobEnabled(user))) {
    sendJob(receiptTexts(order, user), "receipt", { order }, relayJobEnabled(user));
    return;
  }
  browserPrint(user);
}

export function printKitchenSlip(user, slip) {
  apiOnboardingMarkPrint().catch(() => {});
  if (slip && (bridgeEnabled(user) || relayJobEnabled(user))) {
    sendJob([kitchenSlipText(slip)], "kitchen", { slip }, relayJobEnabled(user));
    return;
  }
  window.print();
}

export function printZReport(user, report, restaurantName) {
  if (report && (bridgeEnabled(user) || relayJobEnabled(user))) {
    sendJob(
      [zReportText(report, restaurantName)],
      "zreport",
      { report, restaurant_name: restaurantName },
      relayJobEnabled(user)
    );
    return;
  }
  window.print();
}
