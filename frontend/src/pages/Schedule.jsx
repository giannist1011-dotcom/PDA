import { useMemo, useState } from "react";
import AppShell from "@/components/shared/AppShell";
import ScheduleBoard from "@/components/shared/schedule/ScheduleBoard";
import {
  apiListEmployees,
  apiCreateEmployee,
  apiUpdateEmployee,
  apiDeleteEmployee,
  apiListShifts,
  apiListShiftWeeks,
  apiUpsertShift,
  apiDeleteShift,
  apiAutofillShifts,
} from "@/lib/api";
import { useAuth } from "@/context/shared/AuthContext";
import { printSchedule } from "./schedule/utils";

// Πρόγραμμα υπαλλήλων μαγαζιού — το ίδιο ScheduleBoard με το FleetDeck. Εδώ
// μπαίνουν μόνο τα POS adapters: το backend του μαγαζιού μιλά «employee_id»,
// το κοινό component «member_id».
const toMember = ({ employee_id, ...s }) => ({ ...s, member_id: employee_id });

export default function Schedule() {
  const { user, canManage } = useAuth();
  const [readOnly, setReadOnly] = useState(false);

  const api = useMemo(
    () => ({
      listMembers: apiListEmployees,
      listShifts: (weekStart) => apiListShifts(weekStart).then((rows) => rows.map(toMember)),
      listWeeks: apiListShiftWeeks,
      upsertShift: ({ member_id, week_start, day, start, end }) =>
        apiUpsertShift({ employee_id: member_id, week_start, day, start, end }).then(toMember),
      deleteShift: apiDeleteShift,
      autofill: apiAutofillShifts,
    }),
    []
  );

  const memberActions = useMemo(
    () => ({
      add: apiCreateEmployee,
      rename: apiUpdateEmployee,
      remove: apiDeleteEmployee,
    }),
    []
  );

  return (
    <AppShell title={readOnly ? "Πρόγραμμα (προβολή)" : "Πρόγραμμα υπαλλήλων"}>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        <ScheduleBoard
          api={api}
          canManage={canManage}
          memberActions={memberActions}
          orgName={user?.restaurant_name || ""}
          onReadOnlyChange={setReadOnly}
          onPrint={(ctx) => printSchedule({ ...ctx, user })}
        />
      </main>
    </AppShell>
  );
}
