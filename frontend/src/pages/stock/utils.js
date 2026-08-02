import { printShoppingListJob } from "@/lib/print";

export const OTHER_CATEGORY = "Άλλα";

// Ομαδοποίηση ειδών της λίστας αγορών ανά κατηγορία, με τη σειρά των κατηγοριών
// του αποθέματος. Ό,τι δεν έχει (ακόμη) κατηγορία πάει στο «Άλλα».
// items: [{ text, bought, category_name?, category_id? }]
export function groupShoppingByCategory(items, categories = []) {
  const order = new Map(categories.map((c, i) => [c.name, i]));
  const buckets = new Map();
  (items || []).forEach((it) => {
    const name = (it.category_name || it.category || "").trim() || OTHER_CATEGORY;
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(it);
  });
  return Array.from(buckets.entries())
    .map(([category, list]) => ({ category, items: list }))
    .sort((a, b) => {
      // «Άλλα» πάντα τελευταίο, οι υπόλοιπες με τη σειρά των κατηγοριών
      if (a.category === OTHER_CATEGORY) return 1;
      if (b.category === OTHER_CATEGORY) return -1;
      const ai = order.has(a.category) ? order.get(a.category) : 9999;
      const bi = order.has(b.category) ? order.get(b.category) : 9999;
      return ai - bi || a.category.localeCompare(b.category, "el");
    });
}

// Εκτύπωση λίστας αγορών — χρησιμοποιείται από το κουμπί «Εκτύπωση» (Stock.jsx)
// και από την επανεκτύπωση στο ιστορικό εκτυπώσεων (PrintHistoryModal.jsx).
// Περνά από το ΕΝΙΑΙΟ μηχανισμό εκτύπωσης (lib/print.js): σε Kiosk Relay / Print
// Bridge γίνεται print_job, αλλιώς τυπώνεται στο κρυφό iframe 72mm.
// when: προαιρετική ημερομηνία (ISO) για επανεκτύπωση παλιάς λίστας — default τώρα.
export function printShoppingList({ user, restaurantName, items, categories = [], when = null }) {
  printShoppingListJob(user, {
    restaurant_name: restaurantName || "",
    printed_at: when || new Date().toISOString(),
    groups: groupShoppingByCategory(items, categories).map((g) => ({
      category: g.category,
      items: g.items.map((it) => ({ text: it.text, bought: !!it.bought })),
    })),
  });
}
