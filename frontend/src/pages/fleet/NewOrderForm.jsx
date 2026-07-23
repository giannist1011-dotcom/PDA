import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { apiFleetCreateOrder, apiFleetPickupNames, apiFleetAddressBook } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PAYMENT_LABELS } from "./utils";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Γρήγορη καταχώρηση παραγγελίας από τον συντονιστή: κατάστημα παραλαβής
// (autocomplete από προηγούμενα ονόματα), διεύθυνση (AddressAutocomplete),
// ποσό, πληρωμή, σημείωση.
export default function NewOrderForm({ city, onCreated }) {
  const [pickup, setPickup] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("cash");
  const [notes, setNotes] = useState("");
  const [names, setNames] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFleetPickupNames().then(setNames).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(String(amount).replace(",", "."));
    if (Number.isNaN(amt) || amt < 0) {
      toast.error("Μη έγκυρο ποσό");
      return;
    }
    setBusy(true);
    try {
      await apiFleetCreateOrder({
        pickup_name: pickup.trim(),
        address: address.trim(),
        amount: amt,
        payment,
        notes: notes.trim(),
      });
      setPickup("");
      setAddress("");
      setAmount("");
      setNotes("");
      setPayment("cash");
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
      <div className="md:col-span-4">
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
      <div className="md:col-span-1">
        <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
          Ποσό €
        </label>
        <input
          required
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="fleet-order-amount"
          className={`${inputCls} mt-1 text-right`}
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
          Πληρωμή
        </label>
        <div className="flex gap-1 mt-1">
          {Object.entries(PAYMENT_LABELS).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPayment(k)}
              data-testid={`fleet-order-pay-${k}`}
              className={`flex-1 h-11 rounded-md border text-xs font-semibold ${
                payment === k
                  ? "border-flame bg-[#4A1B27] text-white"
                  : "border-[#723645] bg-[#2A0E14] text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 flex gap-2">
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
