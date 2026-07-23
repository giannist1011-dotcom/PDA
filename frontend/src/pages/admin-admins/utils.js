export const PRODUCT_LABELS = { orderdeck: "OrderDeck", fleet: "Fleet" };
export const RIGHTS_LABELS = { view: "Μόνο προβολή", manage: "Διαχείριση" };
export const AUDIT_ACTION_LABELS = {
  update_shop: "Αλλαγή μαγαζιού",
  update_fleet: "Αλλαγή εταιρίας",
  reset_pin: "Reset PIN προφίλ",
};

export const productsLabel = (products) =>
  (products || []).map((p) => PRODUCT_LABELS[p] || p).join(" + ") || "—";
