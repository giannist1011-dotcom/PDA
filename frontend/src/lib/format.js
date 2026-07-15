export const eur = (n) =>
  `${(Number(n) || 0).toFixed(2).replace(".", ",")}€`;

export const pad2 = (n) => String(n).padStart(2, "0");

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Δέχεται Date, "YYYY-MM-DD" ή ISO datetime string
const toDate = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + "T00:00:00");
  }
  return new Date(v);
};

// Τα παρακάτω χτίζουν το string χειροκίνητα (όχι toLocale*) ώστε το format
// να είναι ΠΑΝΤΑ DD/MM/YYYY και 24ωρο, ανεξάρτητα από locale/browser.

export const formatGRDate = (v) => {
  try {
    const d = toDate(v);
    if (isNaN(d)) return String(v ?? "");
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return String(v ?? "");
  }
};

export const formatGRDayMonth = (v) => {
  try {
    const d = toDate(v);
    if (isNaN(d)) return "";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  } catch {
    return "";
  }
};

export const formatGRTime = (v) => {
  try {
    const d = toDate(v);
    if (isNaN(d)) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch {
    return "";
  }
};

export const formatGRDateTime = (v) => {
  try {
    const d = toDate(v);
    if (isNaN(d)) return String(v ?? "");
    return `${formatGRDate(d)}, ${formatGRTime(d)}`;
  } catch {
    return String(v ?? "");
  }
};

// "14/07 18:30" — συμπαγές για badges/λίστες
export const formatGRDayMonthTime = (v) => {
  try {
    const d = toDate(v);
    if (isNaN(d)) return "";
    return `${formatGRDayMonth(d)} ${formatGRTime(d)}`;
  } catch {
    return "";
  }
};
