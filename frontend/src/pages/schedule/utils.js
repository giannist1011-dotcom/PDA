import { formatWeekRange } from "@/lib/dates";
import { formatGRDayMonth } from "@/lib/format";
import { printScheduleJob } from "@/lib/print";

// ---------- Εκτύπωση εβδομαδιαίου προγράμματος ----------
// Περνά από το ΕΝΙΑΙΟ μηχανισμό εκτύπωσης (lib/print.js): σε Kiosk Relay / Print
// Bridge γίνεται print_job για τον σταθμό, αλλιώς τυπώνεται στο κρυφό iframe.
// Στα 72mm το εβδομαδιαίο πλέγμα δεν χωράει — τυπώνεται ανά υπάλληλο.
export function printSchedule({ user, restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  printScheduleJob(user, {
    restaurant_name: restaurantName || "",
    week_label: `Εβδομάδα ${formatWeekRange(weekStart)}`,
    employees: employees.map((emp) => ({
      name: emp.name,
      days: days.map((d) => {
        const sh = findShift(emp.id, d.idx);
        return {
          label: `${d.short} ${formatGRDayMonth(d.date)}`,
          shift: sh ? `${sh.start}–${sh.end}` : null,
        };
      }),
    })),
  });
}

// ---------- Plain-text schedule for Viber/WhatsApp/SMS ----------
export function buildScheduleText({ restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  const lines = [];
  lines.push(`Πρόγραμμα εβδομάδας ${formatWeekRange(weekStart)}${restaurantName ? " — " + restaurantName : ""}`);

  employees.forEach((emp) => {
    const empShifts = days
      .map((d) => ({ day: d, shift: findShift(emp.id, d.idx) }))
      .filter((x) => x.shift);
    if (empShifts.length === 0) return;
    lines.push("");
    lines.push(emp.name);
    empShifts.forEach(({ day, shift }) => {
      lines.push(`${day.label}: ${shift.start}–${shift.end}`);
    });
  });

  return lines.join("\n");
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
