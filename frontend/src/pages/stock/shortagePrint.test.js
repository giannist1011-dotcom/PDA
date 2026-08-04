import { buildShoppingListPayload } from "./utils";
import { shoppingListText } from "@/lib/receiptText";
import { shoppingListHtml } from "@/lib/printDocs";

// Εγγραφές λίστας αγορών όπως τις επιστρέφει το backend: το `text` των ειδών με
// παραλλαγές είναι ήδη σύνθετο («Σακούλες: 35άρες, 45άρες»).
const SHOPPING = [
  {
    id: "s1",
    text: "Σακούλες: 35άρες, 45άρες",
    variants: ["35άρες", "45άρες"],
    bought: false,
    source_stock_id: "i1",
    category_id: "c1",
    category_name: "Συσκευασίες",
  },
  {
    id: "s2",
    text: "Αλουμινόχαρτο",
    variants: [],
    bought: false,
    source_stock_id: "i2",
    category_id: "c1",
    category_name: "Συσκευασίες",
  },
];

const CATEGORIES = [{ id: "c1", name: "Συσκευασίες", order: 0 }];

describe("εκτύπωση ελλείψεων με παραλλαγές", () => {
  const payload = buildShoppingListPayload({
    restaurantName: "Πεινώκιο",
    items: SHOPPING,
    categories: CATEGORIES,
    when: "2026-08-04T10:00:00.000Z",
  });

  it("κάθε είδος = μία γραμμή, οι παραλλαγές μαζί στο ίδιο είδος", () => {
    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].category).toBe("Συσκευασίες");
    expect(payload.groups[0].items.map((i) => i.text)).toEqual([
      "Σακούλες: 35άρες, 45άρες",
      "Αλουμινόχαρτο",
    ]);
  });

  it("θερμικό χαρτί 72mm: η γραμμή τυπώνεται ολόκληρη", () => {
    const text = shoppingListText(payload);
    expect(text).toContain("[ ] Σακούλες: 35άρες, 45άρες");
    expect(text).toContain("[ ] Αλουμινόχαρτο");
    expect(text).toContain("ΣΥΣΚΕΥΑΣΙΕΣ");
  });

  it("HTML εκτύπωση: ίδιο κείμενο", () => {
    const html = shoppingListHtml(payload);
    expect(html).toContain("Σακούλες: 35άρες, 45άρες");
    expect(html).toContain("Αλουμινόχαρτο");
  });
});
