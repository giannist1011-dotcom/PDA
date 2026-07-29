import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Send, Store, Zap } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  apiStoreFleetAddressBook,
  apiStoreFleetCreateOrder,
  formatApiError,
} from "@/lib/api";
import { geocodeFleetAddress } from "@/pages/fleet/utils";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";
const labelCls = "text-[11px] uppercase tracking-widest font-bold text-neutral-400";

// Χρόνος δημοσίευσης: «Άμεσα» ή προγραμματισμένη σε 5'/10'/20'/25' (τα λεπτά
// επικυρώνονται και στο backend — PUBLISH_DELAYS)
const DELAYS = [
  { value: 0, label: "Άμεσα" },
  { value: 5, label: "5'" },
  { value: 10, label: "10'" },
  { value: 20, label: "20'" },
  { value: 25, label: "25'" },
];

// Φόρμα ανεβάσματος παραγγελίας από το κατάστημα: σταθερό όνομα καταστήματος
// (η παραλαβή των οδηγών), επιλογή εταιρείας από τις ενεργές συνεργασίες,
// διεύθυνση με pin, προαιρετικό τηλέφωνο, σχόλια, ⚡ και χρόνο δημοσίευσης.
export default function StoreOrderForm({
  storeName,
  city,
  storeLat = null,
  storeLng = null,
  radiusKm = null,
  partnerships,
  teamId,
  onTeamChange,
  onCreated,
}) {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(null);
  const [floor, setFloor] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [delay, setDelay] = useState(0);
  const [busy, setBusy] = useState(false);
  const noPartner = partnerships.length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!teamId) return;
    setBusy(true);
    try {
      // Χωρίς επιλεγμένο pin → auto-geocode ώστε η παραγγελία να βγαίνει στον
      // χάρτη της εταιρείας όποτε η διεύθυνση βρίσκεται (ίδιο pattern με το fleet)
      const c = coords || (await geocodeFleetAddress(address.trim(), city));
      await apiStoreFleetCreateOrder({
        team_id: teamId,
        address: address.trim(),
        floor: floor.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        urgent,
        delay_minutes: delay,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
      });
      setAddress("");
      setCoords(null);
      setFloor("");
      setPhone("");
      setNotes("");
      setUrgent(false);
      setDelay(0);
      onCreated();
      toast.success(
        delay > 0
          ? `Η παραγγελία θα δημοσιευτεί σε ${delay}'`
          : "Η παραγγελία στάλθηκε στους οδηγούς"
      );
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-[#3D1620] border border-[#723645] rounded-lg p-4 space-y-3"
      data-testid="store-fleet-new-order"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls}>Κατάστημα (παραλαβή)</label>
          {/* Σταθερό, μη επεξεργάσιμο — οι οδηγοί παραλαμβάνουν πάντα από εδώ */}
          <div
            className="mt-1 h-11 px-3 rounded-md border border-[#723645] bg-[#2A0E14]/60 text-sm text-neutral-300 flex items-center gap-2"
            data-testid="store-fleet-store-name"
          >
            <Store className="w-4 h-4 text-flame shrink-0" />
            <span className="truncate font-semibold">{storeName}</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>Εταιρία delivery</label>
          {noPartner ? (
            <div
              className="mt-1 min-h-[44px] px-3 py-2 rounded-md border border-dashed border-[#723645] text-xs text-neutral-400 flex items-center"
              data-testid="store-fleet-no-partner-hint"
            >
              <span>
                Καμία ενεργή συνεργασία —{" "}
                <Link
                  to="/app/fleet/partners"
                  className="text-flame font-semibold hover:underline"
                >
                  στείλτε αίτημα συνεργασίας
                </Link>
              </span>
            </div>
          ) : (
            <select
              value={teamId || ""}
              onChange={(e) => onTeamChange(e.target.value)}
              data-testid="store-fleet-company-select"
              className={`${inputCls} mt-1`}
            >
              {partnerships.map((p) => (
                <option key={p.team_id} value={p.team_id}>
                  {p.team_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls}>Διεύθυνση παράδοσης</label>
          <AddressAutocomplete
            value={address}
            onChange={(v) => {
              setAddress(v);
              setCoords(null);
            }}
            onPick={setCoords}
            city={city}
            storeLat={storeLat}
            storeLng={storeLng}
            radiusKm={radiusKm || undefined}
            fetchBook={apiStoreFleetAddressBook}
            placeholder="Οδός και αριθμός"
            testId="store-fleet-order-address"
            className="mt-1"
          />
          {/* Χωρίς πόλη/pin οι προτάσεις είναι πανελλαδικές — παραπομπή στις ρυθμίσεις */}
          {!city && storeLat == null && (
            <div className="text-[11px] text-neutral-500 mt-1" data-testid="store-fleet-city-hint">
              <Link to="/app/fleet/settings" className="text-flame hover:underline">
                Όρισε τη διεύθυνσή σου
              </Link>{" "}
              για καλύτερες προτάσεις
            </div>
          )}
          {/* Όροφος αμέσως μετά τη διεύθυνση — ο οδηγός τον βλέπει κάτω από αυτήν */}
          <input
            maxLength={60}
            placeholder="Όροφος (προαιρετικό) — π.χ. 3ος, ισόγειο"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            data-testid="store-fleet-order-floor"
            className={`${inputCls} mt-2`}
          />
        </div>
        <div>
          <label className={labelCls}>Τηλέφωνο πελάτη (προαιρετικό)</label>
          <input
            inputMode="tel"
            maxLength={20}
            placeholder="π.χ. 69..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="store-fleet-order-phone"
            className={`${inputCls} mt-1`}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Σχόλια</label>
        <input
          maxLength={300}
          placeholder="Προαιρετικά — π.χ. 2ος όροφος, κουδούνι Παπαδόπουλος"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="store-fleet-order-notes"
          className={`${inputCls} mt-1`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setUrgent((v) => !v)}
          title="⚡ Επείγον — πρώτη στις Ελεύθερες των οδηγών"
          data-testid="store-fleet-order-urgent"
          className={`h-11 px-3 rounded-md border flex items-center gap-1.5 text-sm font-bold transition-colors ${
            urgent
              ? "border-gold bg-gold/15 text-gold"
              : "border-[#723645] text-neutral-500 hover:border-gold/60"
          }`}
        >
          <Zap className="w-4 h-4" /> Επείγον
        </button>
        <div className="flex gap-1.5 ml-auto" data-testid="store-fleet-delay-pills">
          {DELAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDelay(d.value)}
              data-testid={`store-fleet-delay-${d.value}`}
              className={`h-11 px-3 rounded-md border text-sm font-bold transition-colors ${
                delay === d.value
                  ? "bg-brand border-brand text-white"
                  : "border-[#723645] text-neutral-300 hover:border-flame/60"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <Button
          type="submit"
          disabled={busy || noPartner || !teamId || !address.trim()}
          data-testid="store-fleet-order-submit"
          className="h-11 bg-brand hover:bg-brand-hover text-white font-bold px-5"
        >
          <Send className="w-4 h-4 mr-1.5" /> Αποστολή
        </Button>
      </div>
    </form>
  );
}
