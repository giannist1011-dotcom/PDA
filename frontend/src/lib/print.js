// Εκτύπωση απόδειξης με βάση τις ρυθμίσεις του λογαριασμού.
//
// - Αντίγραφα: τα χειρίζεται το <Receipt /> (τυπώνει N σελίδες σε ΕΝΑ print job,
//   ώστε να δουλεύει και με silent/kiosk printing χωρίς extra dialogs).
// - Διπλή εκτύπωση (2ος εκτυπωτής): ο browser ΔΕΝ επιτρέπει επιλογή εκτυπωτή
//   προγραμματιστικά, οπότε ανοίγουμε δεύτερο print dialog — εκεί ο χρήστης
//   (ή το kiosk setup) στέλνει το job στον δεύτερο εκτυπωτή.
import { apiOnboardingMarkPrint } from "@/lib/api";

export function printReceiptJob(user) {
  // Onboarding: σημείωσε ότι έγινε εκτύπωση (fire-and-forget, δεν μπλοκάρει)
  apiOnboardingMarkPrint().catch(() => {});
  window.print();
  if (user?.print_double) {
    // Το window.print() είναι blocking όσο είναι ανοιχτό το dialog —
    // μικρή αναμονή ώστε να προλάβει να κλείσει πριν το δεύτερο.
    setTimeout(() => window.print(), 400);
  }
}
