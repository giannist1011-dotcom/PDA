// Αναζήτηση προϊόντων & ταίριασμα κωδικού — κοινό για πλέγμα (MenuGrid),
// λίστα (MenuList) και το αριθμητικό πληκτρολόγιο (CodeNumpad).
import { normText } from "@/lib/text";

const codeOf = (i) => normText(String(i.code ?? ""));

// Όνομα (χωρίς τόνους) ή κωδικός — σε ΟΛΕΣ τις κατηγορίες
export const searchItems = (items, q) =>
  !q ? null : items.filter((i) => normText(i.name).includes(q) || (i.code && codeOf(i).includes(q)));

// Ακριβής κωδικός → το προϊόν (ή null)
export const findExactCode = (items, value) => {
  const v = normText(String(value ?? "").trim());
  if (!v) return null;
  return items.find((i) => i.code && codeOf(i) === v) || null;
};

// Υπάρχει άλλος κωδικός που ξεκινά με ό,τι γράφτηκε; (το "1" δεν πρέπει να
// «κλέβει» το "12" — τότε η επιλογή γίνεται μόνο με Enter)
export const isAmbiguousCode = (items, exact, value) => {
  const v = normText(String(value ?? "").trim());
  return items.some((i) => i !== exact && i.code && codeOf(i).startsWith(v));
};

// Σειρά λίστας: αριθμητικοί κωδικοί → αλφαριθμητικοί → χωρίς κωδικό (τελευταία)
export const sortByCode = (items) =>
  [...items].sort((a, b) => {
    const ca = String(a.code ?? "").trim();
    const cb = String(b.code ?? "").trim();
    if (!ca && !cb) return 0;
    if (!ca) return 1;
    if (!cb) return -1;
    const na = /^\d+$/.test(ca);
    const nb = /^\d+$/.test(cb);
    if (na && nb) return Number(ca) - Number(cb);
    if (na !== nb) return na ? -1 : 1;
    return ca.localeCompare(cb, "el");
  });
