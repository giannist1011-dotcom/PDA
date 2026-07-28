// Σταθερή σειρά εμφάνισης/εκτύπωσης των επιλογών ενός είδους (σάντουιτς κ.λπ.),
// ΑΝΕΞΑΡΤΗΤΑ από τη σειρά που τα πάτησε ο χρήστης:
//   1) ψωμί  2) διπλό  3) υλικά  4) ό,τι δεν κατηγοριοποιείται  5) σως (τελευταίο)
// Η κατηγορία βγαίνει από το ΟΝΟΜΑ της ομάδας επιλογών — όχι από ονόματα προϊόντων —
// ώστε να δουλεύει σε κάθε μαγαζί. Ό,τι δεν αναγνωρίζεται κρατά την παλιά μορφή
// «Ομάδα: τιμές» και μπαίνει μετά τα υλικά.

const deaccent = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const CATEGORY_RE = [
  ["bread", /ψωμ|πιτα|bread|bun/],
  ["double", /διπλ|double/],
  ["sauce", /σως|σαλτσ|αλοιφ|ντιπ|sauce|dip/],
  ["ingredients", /υλικ|extra|εξτρα|γεμισ|προσθ|topping/],
];

// «Έξτρα υλικά» → "ingredients", «Σως» → "sauce", «Μέγεθος» → null
export const modifierCategory = (groupName) => {
  const n = deaccent(groupName);
  if (!n) return null;
  for (const [cat, re] of CATEGORY_RE) if (re.test(n)) return cat;
  return null;
};

// Ελάχιστο πλήθος διαθέσιμων υλικών για να έχει νόημα το «απ' όλα»
export const ALL_MIN_POOL = 3;
export const ALL_LABEL = "Απ' όλα";
const ALL_TEXT = "απ' όλα";

// Όλα τα υλικά του προϊόντος είναι επιλεγμένα;
export const isAllSelected = (selected, pool) =>
  (pool || []).length >= ALL_MIN_POOL && (pool || []).every((n) => (selected || []).includes(n));

// Γραμμή υλικών: «απ' όλα» όταν είναι όλα, «απ' όλα χωρίς Χ, Υ» όταν βγαίνει
// συντομότερο από το να απαριθμηθούν όσα μπήκαν, αλλιώς η απλή λίστα.
const ingredientsText = (selected, pool) => {
  const list = (selected || []).filter(Boolean);
  if (!list.length) return "";
  const plain = list.join(", ");
  const full = (pool || []).filter(Boolean);
  if (full.length < ALL_MIN_POOL) return plain;
  const missing = full.filter((n) => !list.includes(n));
  if (!missing.length) return ALL_TEXT;
  const without = `${ALL_TEXT} χωρίς ${missing.join(", ")}`;
  return without.length < plain.length ? without : plain;
};

// Οι γραμμές των επιλογών σε σταθερή σειρά — μία γραμμή ανά κατηγορία
export const customizationLines = (c) => {
  if (!c) return [];
  const bread = [];
  const double = [];
  const ingredients = [];
  const other = [];
  const sauce = [];

  // Legacy λογαριασμοί: τα πεδία είναι ήδη κατηγοριοποιημένα
  if (c.bread) bread.push(c.bread);
  if (c.double_meat) double.push("Διπλό κρέας");
  if (c.extras?.length) {
    const t = ingredientsText(c.extras, c.extras_pool);
    if (t) ingredients.push(t);
  }
  if (c.sauces?.length) sauce.push(c.sauces.join(", "));

  // Ομάδες επιλογών: κατηγορία από το όνομα της ομάδας
  (c.selections || []).forEach((sel) => {
    const names = (sel.choices || []).map((ch) => ch.name).filter(Boolean);
    if (!names.length) return;
    switch (modifierCategory(sel.group_name)) {
      case "bread":
        bread.push(names.join(", "));
        break;
      case "double":
        double.push(names.join(", "));
        break;
      case "ingredients": {
        const t = ingredientsText(names, sel.pool);
        if (t) ingredients.push(t);
        break;
      }
      case "sauce":
        sauce.push(names.join(", "));
        break;
      default:
        other.push(`${sel.group_name}: ${names.join(", ")}`);
    }
  });

  return [...bread, ...double, ...ingredients, ...other, ...sauce];
};

// Μονόγραμμη σύνοψη για λίστες/modals που δεν έχουν χώρο για πολλές γραμμές
export const customizationSummary = (c) => customizationLines(c).join(" · ");
