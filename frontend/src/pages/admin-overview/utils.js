// Κοινά helpers του admin dashboard (Επισκόπηση)

export const fmtEur = (v) =>
  `${Number(v || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const PLAN_LABELS = {
  orderdeck: "OrderDeck",
  fleet: "FleetDeck",
  orderdeck_fleet: "OrderDeck Fleet",
};

// «πριν 5'», «πριν 3 ώρες», «χθες», «12/07» — για τη ροή δραστηριότητας
export const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "μόλις τώρα";
  if (mins < 60) return `πριν ${mins}'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `πριν ${hours} ${hours === 1 ? "ώρα" : "ώρες"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "χθες";
  if (days < 7) return `πριν ${days} ημέρες`;
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
};
