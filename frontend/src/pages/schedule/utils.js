import { formatWeekRange } from "@/lib/dates";
import { formatGRDayMonth } from "@/lib/format";
import { printScheduleJob } from "@/lib/print";

// ---------- Εκτύπωση εβδομαδιαίου προγράμματος (OrderDeck) ----------
// Περνά από το ΕΝΙΑΙΟ μηχανισμό εκτύπωσης (lib/print.js): σε Kiosk Relay / Print
// Bridge γίνεται print_job για τον σταθμό, αλλιώς τυπώνεται στο κρυφό iframe.
// Στα 72mm το εβδομαδιαίο πλέγμα δεν χωράει — τυπώνεται ανά υπάλληλο.
export function printSchedule({ user, orgName, weekStart, members, shifts, days }) {
  const findShift = (memberId, dayIdx) =>
    shifts.find((s) => s.member_id === memberId && s.day === dayIdx);

  printScheduleJob(user, {
    restaurant_name: orgName || "",
    week_label: `Εβδομάδα ${formatWeekRange(weekStart)}`,
    employees: members.map((m) => ({
      name: m.name,
      days: days.map((d) => {
        const sh = findShift(m.id, d.idx);
        return {
          label: `${d.short} ${formatGRDayMonth(d.date)}`,
          shift: sh ? `${sh.start}–${sh.end}` : null,
        };
      }),
    })),
  });
}
