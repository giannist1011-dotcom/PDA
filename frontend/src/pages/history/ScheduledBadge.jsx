import { formatGRDayMonthTime } from "@/lib/format";

const schedLabel = (iso) => formatGRDayMonthTime(iso);

const ScheduledBadge = ({ order }) => {
  if (!order.scheduled_at) return null;
  const pending = order.status === "scheduled";
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
        pending ? "bg-[#00B0FF]/20 text-[#00B0FF]" : "bg-[#00B0FF]/10 text-[#00B0FF]/70"
      }`}
      title={pending ? "Δεν έχει τυπωθεί ακόμα" : "Είχε προγραμματιστεί"}
    >
      Προγρ. {schedLabel(order.scheduled_at)}
    </span>
  );
};

export default ScheduledBadge;
