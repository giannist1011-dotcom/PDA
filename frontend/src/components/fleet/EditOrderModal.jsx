import { useState } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import AddressAutocomplete from "@/components/shared/AddressAutocomplete";
import { apiFleetEditOrder, apiFleetAddressBook } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { geocodeFleetAddress } from "./utils";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Επεξεργασία παραγγελίας από τον διαχειριστή. Αν έχει ήδη οδηγό, η αποθήκευση
// τον ειδοποιεί («Η #Χ ενημερώθηκε») με τα αλλαγμένα πεδία μαρκαρισμένα.
export default function EditOrderModal({
  order,
  city,
  companyLat = null,
  companyLng = null,
  onClose,
  onSaved,
}) {
  const [pickup, setPickup] = useState(order.pickup_name || "");
  const [address, setAddress] = useState(order.address || "");
  // Pin της διεύθυνσης: ξεκινά από την παραγγελία, καθαρίζει σε πληκτρολόγηση,
  // ξαναγεμίζει από επιλογή πρότασης ή auto-geocode στην αποθήκευση
  const [coords, setCoords] = useState(
    order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : null
  );
  const [notes, setNotes] = useState(order.notes || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = coords || (await geocodeFleetAddress(address.trim(), city));
      const res = await apiFleetEditOrder(order.id, {
        pickup_name: pickup.trim(),
        address: address.trim(),
        notes: notes.trim(),
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
      });
      toast.success(
        res.changed?.length && order.driver_name
          ? `Αποθηκεύτηκε — ο/η ${order.driver_name} θα ειδοποιηθεί`
          : "Αποθηκεύτηκε"
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-[#3D1620] border border-[#723645] rounded-lg p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-flame" />
          <h2 className="font-heading font-bold text-lg flex-1">
            Επεξεργασία #{order.number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
            Παραλαβή από
          </label>
          <input
            required
            maxLength={80}
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            data-testid="fleet-edit-pickup"
            className={`${inputCls} mt-1`}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
            Διεύθυνση παράδοσης
          </label>
          <AddressAutocomplete
            value={address}
            onChange={(v) => {
              setAddress(v);
              setCoords(null);
            }}
            onPick={setCoords}
            city={city}
            storeLat={companyLat}
            storeLng={companyLng}
            radiusKm={10}
            fetchBook={apiFleetAddressBook}
            placeholder="Οδός και αριθμός"
            testId="fleet-edit-address"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
            Σημείωση
          </label>
          <input
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="fleet-edit-notes"
            className={`${inputCls} mt-1`}
          />
        </div>
        {order.driver_name && (
          <div className="text-xs text-gold">
            Η παραγγελία είναι στον/στην {order.driver_name} — θα δει ειδοποίηση με τις αλλαγές.
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          data-testid="fleet-edit-save"
          className="w-full h-11 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold disabled:opacity-60"
        >
          Αποθήκευση
        </button>
      </form>
    </div>
  );
}
