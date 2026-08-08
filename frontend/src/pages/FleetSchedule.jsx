import { useMemo } from "react";
import FleetShell from "@/pages/fleet/FleetShell";
import ScheduleBoard from "@/components/shared/schedule/ScheduleBoard";
import { printScheduleInBrowser } from "@/components/shared/schedule/utils";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import {
  apiFleetMembers,
  apiFleetSchedule,
  apiFleetScheduleWeeks,
  apiFleetUpsertScheduleShift,
  apiFleetDeleteScheduleShift,
  apiFleetAutofillSchedule,
} from "@/lib/fleetApi";

// «Πρόγραμμα» εταιρείας διανομής (μόνο διαχείριση) — ίδιο ScheduleBoard με το
// πρόγραμμα υπαλλήλων του OrderDeck. Τα μέλη έρχονται από τους «Διανομείς»
// (διαχειριστές + διανομείς) και δεν δημιουργούνται/διαγράφονται από εδώ.
// Η εταιρεία δεν έχει σταθμό εκτύπωσης: η εκτύπωση γίνεται από τον browser (A4).
export default function FleetSchedule() {
  const { team } = useFleet();

  const api = useMemo(
    () => ({
      listMembers: () =>
        apiFleetMembers().then((rows) =>
          rows.map((m) => ({
            id: m.id,
            name: m.name,
            sub: m.role === "fleet_admin" ? "Διαχείριση" : "Διανομέας",
          }))
        ),
      listShifts: apiFleetSchedule,
      listWeeks: apiFleetScheduleWeeks,
      upsertShift: apiFleetUpsertScheduleShift,
      deleteShift: apiFleetDeleteScheduleShift,
      autofill: apiFleetAutofillSchedule,
    }),
    []
  );

  return (
    <FleetShell title="Πρόγραμμα">
      <ScheduleBoard
        api={api}
        canManage
        labels={{
          member: "Μέλος",
          empty: "Δεν υπάρχουν μέλη — προσθέστε διανομείς από τους «Διανομείς»",
        }}
        orgName={team && team !== false ? team.name : ""}
        onPrint={printScheduleInBrowser}
      />
    </FleetShell>
  );
}
