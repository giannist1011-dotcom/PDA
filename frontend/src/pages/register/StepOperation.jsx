import { LayoutGrid, Users } from "lucide-react";
import { YesNo } from "./FieldYesNo";

export default function StepOperation({ form, set }) {
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold">Πώς λειτουργείτε;</h1>
      <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-lg">
        <div className="flex items-center gap-2 font-semibold">
          <LayoutGrid className="w-5 h-5 text-flame" /> Έχετε τραπέζια;
        </div>
        <div className="text-xs text-neutral-500 mt-1 mb-2">
          Ενεργοποιεί καρτέλες ανά τραπέζι με γύρους για την κουζίνα (8 έτοιμα τραπέζια)
        </div>
        <YesNo value={form.has_tables} onChange={(v) => set("has_tables", v)} testId="register-tables" />
      </div>
      <div className="p-4 bg-[#2A0E14] border border-[#723645] rounded-lg">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="w-5 h-5 text-flame" /> Έχετε σερβιτόρους;
        </div>
        <div className="text-xs text-neutral-500 mt-1 mb-2">
          Δημιουργεί έτοιμο προφίλ Σερβιτόρου (πρόσβαση μόνο στα Τραπέζια)
        </div>
        <YesNo value={form.has_waiters} onChange={(v) => set("has_waiters", v)} testId="register-waiters" />
      </div>
    </div>
  );
}
