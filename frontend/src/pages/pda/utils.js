import { formatGRTime, formatGRDayMonthTime } from "@/lib/format";

export const schedDateTime = (iso) => {
  try {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? formatGRTime(d) : formatGRDayMonthTime(d);
  } catch {
    return "";
  }
};
