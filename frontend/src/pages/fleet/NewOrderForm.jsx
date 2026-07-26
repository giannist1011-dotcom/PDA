import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Zap } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { apiFleetCreateOrder, apiFleetPickupNames, apiFleetAddressBook } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Γρήγορη καταχώρηση παραγγελίας από τον διαχειριστή: κατάστημα παραλαβής
// (autocomplete από προηγούμενα ονόματα), διεύθυνση (AddressAutocomplete),
// σημείωση. Χωρίς ποσά/πληρωμή — υπόθεση του μαγαζιού, όχι της εταιρείας.
export default function NewOrderForm({ city, onCreated }) {
  const [pickup, setPickup] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [names, setNames] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFleetPickupNames().then(setNames).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFleetCreateOrder({
        pickup_name: pickup.trim(),
        address: address.trim(),
        notes: notes.trim(),
        urgent,
      });
      setPickup("");
      setAddress("");
      setNotes("");
      setUrgent(false);
      if (!names.includes(pickup.trim())) setNames((n) => [...n, pickup.trim()].sort());
      onCreated();
      toast.success("Η παραγγελία καταχωρήθηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-[#3D1620] border border-[#723645] rounded-lg p-4 grid gap-3 md:grid-cols-12 items-end"
      data-testid="fleet-new-order"
    >
      <div className="md:col-span-3">
        <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
          Παραλαβή από
        </label>
        <input
          required
          list="fleet-pickup-names"
          maxLength={80}
          placeholder="π.χ. Πεινώκιο"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          data-testid="fleet-order-pickup"
          className={`${inputCls} mt-1`}
        />
        <datalist id="fleet-pickup-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="md:col-span-5">
        <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
          Διεύθυνση παράδοσης
        </label>
        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          city={city}
          fetchBook={apiFleetAddressBook}
          placeholder="Οδός και αριθμός"
          testId="fleet-order-address"
          className="mt-1"
        />
      </div>
      <div className="md:col-span-4 flex gap-2">
        <div className="flex-1">
          <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
            Σημείωση
          </label>
          <input
            maxLength={300}
            placeholder="Προαιρετική"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="fleet-order-notes"
            className={`${inputCls} mt-1`}
          />
        </div>
        <button
          type="button"
          onClick={() => setUrgent((v) => !v)}
          title="⚡ Επείγον — πρώτη στις Ελεύθερες των οδηγών"
          data-testid="fleet-order-urgent"
          className={`h-11 w-11 self-end shrink-0 rounded-md border flex items-center justify-center transition-colors ${
            urgent
              ? "border-gold bg-gold/15 text-gold"
              : "border-[#723645] text-neutral-500 hover:border-gold/60"
          }`}
        >
          <Zap className="w-4 h-4" />
        </button>
        <Button
          type="submit"
          disabled={busy}
          data-testid="fleet-order-submit"
          className="h-11 self-end bg-brand hover:bg-brand-hover text-white font-bold px-4"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
