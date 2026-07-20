import { formatGRTime } from "@/lib/format";

export const summarize = (c) => {
  if (!c) return null;
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Υλικά: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Αλοιφές: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((sel) => {
      const names = sel.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${sel.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

export const roundTime = (iso) => formatGRTime(iso);
