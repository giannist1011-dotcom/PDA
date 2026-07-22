import { Sunrise, Moon } from "lucide-react";

export const LIST_META = {
  open: { label: "Άνοιγμα", icon: Sunrise, color: "text-gold" },
  close: { label: "Κλείσιμο", icon: Moon, color: "text-flame" },
};

// Σύντομη ελληνική ημερομηνία για τα badges των έκτακτων (one-off) εργασιών
export const fmtShortDateGR = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return iso;
  }
};
