import { useEffect, useState } from "react";
import { MapPin, Store } from "lucide-react";
import AddressPickerModal from "@/components/shared/AddressPickerModal";
import { apiFleetAddressBook, apiFleetPartnerStores } from "@/lib/fleetApi";

const CUSTOM = "__custom__";

// «Παραλαβή από» της φόρμας του διαχειριστή εταιρείας — ΔΥΟ τρόποι σε ένα
// dropdown:
//   · συνεργαζόμενο μαγαζί → όνομα + διεύθυνση + το γνωστό pin των ρυθμίσεών του
//   · «Διεύθυνση...» → ανοίγει το κοινό AddressPickerModal (autocomplete με bias
//     πόλης/pin εταιρείας + χάρτης με σερνόμενο pin) για παραλαβή από οπουδήποτε
// Χωρίς συνεργασίες το dropdown έχει ΜΟΝΟ το «Διεύθυνση...» — κανένα παράδειγμα
// με όνομα μαγαζιού.
// value: {name, address, lat, lng} — το κρατά ο γονιός και το στέλνει ως
// pickup_name / pickup_address / pickup_lat / pickup_lng.
export default function PickupPicker({
  value,
  onChange,
  city,
  companyLat = null,
  companyLng = null,
  label = "Παραλαβή από",
  testId = "fleet-pickup",
}) {
  const [stores, setStores] = useState([]);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFleetPartnerStores()
      .then((d) => alive && setStores(d.stores || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Ποια επιλογή είναι ενεργή: το μαγαζί με το ίδιο όνομα, αλλιώς «Διεύθυνση...»
  // όταν υπάρχει ήδη κείμενο (και σε παλιές παραγγελίες με ελεύθερο όνομα)
  const matched = stores.find((s) => s.name && s.name === value?.name);
  const selected = matched ? matched.store_user_id : value?.name ? CUSTOM : "";

  const pick = (v) => {
    if (v === CUSTOM) {
      setPicker(true);
      return;
    }
    const s = stores.find((x) => x.store_user_id === v);
    if (!s) {
      onChange({ name: "", address: "", lat: null, lng: null });
      return;
    }
    onChange({ name: s.name, address: s.address, lat: s.lat ?? null, lng: s.lng ?? null });
  };

  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
        {label}
      </label>
      <select
        value={selected}
        onChange={(e) => pick(e.target.value)}
        data-testid={`${testId}-select`}
        className="w-full h-11 mt-1 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
      >
        <option value="">Επιλέξτε σημείο παραλαβής</option>
        {stores.map((s) => (
          <option key={s.store_user_id} value={s.store_user_id}>
            {s.name}
          </option>
        ))}
        <option value={CUSTOM}>Διεύθυνση...</option>
      </select>

      {/* Τι επιλέχθηκε τελικά — όνομα/διεύθυνση + ένδειξη ότι υπάρχει pin */}
      {value?.name && (
        <div
          className="mt-1.5 flex items-start gap-1.5 text-xs text-neutral-300"
          data-testid={`${testId}-summary`}
        >
          {matched ? (
            <Store className="w-3.5 h-3.5 text-flame shrink-0 mt-0.5" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-flame shrink-0 mt-0.5" />
          )}
          <span className="min-w-0">
            <span className="font-semibold">{value.name}</span>
            {value.address && value.address !== value.name && ` · ${value.address}`}
            {value.lat == null && (
              <span className="text-neutral-500"> · χωρίς pin στον χάρτη</span>
            )}
          </span>
          {!matched && (
            <button
              type="button"
              onClick={() => setPicker(true)}
              data-testid={`${testId}-edit`}
              className="ml-auto shrink-0 text-flame font-semibold hover:underline"
            >
              Αλλαγή
            </button>
          )}
        </div>
      )}

      {picker && (
        <AddressPickerModal
          title="Σημείο παραλαβής"
          initialAddress={matched ? "" : value?.address || value?.name || ""}
          initialLat={matched ? null : value?.lat ?? null}
          initialLng={matched ? null : value?.lng ?? null}
          city={city}
          accountLat={companyLat}
          accountLng={companyLng}
          fetchBook={apiFleetAddressBook}
          testId={`${testId}-modal`}
          onClose={() => setPicker(false)}
          onSave={({ address, lat, lng }) => {
            // Ελεύθερο σημείο: η ίδια η διεύθυνση είναι και η ταυτότητα της
            // παραλαβής — αυτό βλέπει ο οδηγός στην κάρτα του
            onChange({ name: address, address, lat, lng });
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
