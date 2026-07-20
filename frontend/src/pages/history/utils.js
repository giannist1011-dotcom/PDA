export const typeLabel = (order) => {
  const t = order.delivery?.delivery_type;
  if (t === "delivery") return "Παράδοση";
  if (t === "takeaway") return "Takeaway";
  if (order.source === "Τραπέζι") return order.table_name || "Τραπέζι";
  return "—";
};

export const sourceBadgeCls = {
  "Ταμείο": "bg-flame/15 text-flame",
  "Τηλέφωνο": "bg-[#00B0FF]/15 text-[#00B0FF]",
  efood: "bg-[#00E676]/15 text-[#00E676]",
  Box: "bg-gold/15 text-gold",
  "Τραπέζι": "bg-[#B388FF]/15 text-[#B388FF]",
};
