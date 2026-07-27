import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Zap } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { apiFleetCreateOrder, apiFleetPickupNames, apiFleetAddressBook } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { geocodeFleetAddress } from "./utils";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Ακτίνα προτάσεων γύρω από το pin της εταιρείας — πιο φαρδιά από μαγαζιού
// (η εταιρεία καλύπτει όλη την πόλη, όχι ζώνη διανομής ενός καταστήματος)
const COMPANY_SUGGEST_RADIUS_KM = 10;

// Γρήγορη καταχώρηση παραγγελίας από τον διαχειριστή: κατάστημα παραλαβής
// (autocomplete από προηγούμενα ονόματα), διεύθυνση (AddressAutocomplete με
// bias στο pin/πόλη της εταιρείας), σημείωση. Χωρίς ποσά/πληρωμή — υπόθεση
// του μαγαζιού, όχι της εταιρείας.
export default function NewOrderForm({ city, companyLat = null, companyLng = null, onCreated }) {
  const [pickup, setPickup] = useState("");
  const [address, setAddress] = useState("");
  // Pin της διεύθυνσης: από επιλογή πρότασης· καθαρίζει σε κάθε πληκτρολόγηση
  const [coords, setCoords] = useState(null);
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
      // Χωρίς επιλεγμένο pin → auto-geocode της πρώτης πρότασης, ώστε κάθε
      // παραγγελία να βγαίνει στον χάρτη όποτε η διεύθυνση βρίσκεται
      const c = coords || (await geocodeFleetAddress(address.trim(), city));
      await apiFleetCreateOrder({
        pickup_name: pickup.trim(),
        address: address.trim(),
        notes: notes.trim(),
        urgent,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
      });
      setPickup("");
      setAddress("");
      setCoords(null);
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
          onChange={(v) => {
            setAddress(v);
            setCoords(null);
          }}
          onPick={setCoords}
          city={city}
          storeLat={companyLat}
          storeLng={companyLng}
          radiusKm={COMPANY_SUGGEST_RADIUS_KM}
          fetchBook={apiFleetAddressBook}
          placeholder="Οδός και αριθμός"
          testId="fleet-order-address"
          className="mt-1"
        />
        {/* Χωρίς πόλη/pin οι προτάσεις είναι πανελλαδικές — παραπομπή στις ρυθμίσεις */}
        {!city && companyLat == null && (
          <div className="text-[11px] text-neutral-500 mt-1" data-testid="fleet-order-city-hint">
            <Link to="/fleet/settings" className="text-flame hover:underline">
              Όρισε τη διεύθυνσή σου
            </Link>{" "}
            για καλύτερες προτάσεις
          </div>
        )}
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
