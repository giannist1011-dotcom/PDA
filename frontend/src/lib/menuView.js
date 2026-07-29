// Προβολή περιοχής προϊόντων στο ταμείο: «Πλέγμα» (default) ή «Λίστα».
// Αποθηκεύεται ΑΝΑ ΣΥΣΚΕΥΗ και ΑΝΑ ΠΡΟΦΙΛ (localStorage) — ο ένας υπάλληλος
// μπορεί να δουλεύει με λίστα και ο άλλος με πλέγμα στην ίδια εγκατάσταση.

const key = (profileId) => `orderdeck_menu_view_${profileId || "default"}`;

export const getMenuView = (profileId) => {
  try {
    return localStorage.getItem(key(profileId)) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

export const setMenuView = (profileId, view) => {
  try {
    localStorage.setItem(key(profileId), view === "list" ? "list" : "grid");
  } catch {
    // localStorage μη διαθέσιμο — η προτίμηση ισχύει μόνο για τη συνεδρία
  }
};
