import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Truck, UserRound, ShieldCheck } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetMembers } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Επιλογή μέλους με 4-ψήφιο PIN (μετά το login εταιρείας) — αντίστοιχο του
// ProfileSelect των μαγαζιών, απλοποιημένο για κινητό/tablet.
export default function FleetSelect() {
  const { team, selectMember } = useFleet();
  const navigate = useNavigate();
  const [members, setMembers] = useState(null);
  const [picked, setPicked] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (team && team !== false)
      apiFleetMembers()
        // Διανομείς με προσωπικό λογαριασμό μπαίνουν από /fleet/driver-login (χωρίς PIN)
        .then((ms) => setMembers(ms.filter((m) => !m.account_id)))
        .catch(() => setMembers([]));
  }, [team]);

  if (team === undefined)
    return (
      <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center">
        <span className="text-neutral-400 text-sm">Φόρτωση...</span>
      </div>
    );
  if (team === false) return <Navigate to="/fleet/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!picked || pin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const data = await selectMember(picked.id, pin);
      navigate(data.role === "driver" ? "/fleet/driver" : "/fleet");
    } catch (err) {
      setError(formatApiError(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Truck className="w-6 h-6 text-flame" />
          <span className="font-heading text-xl font-bold">{team.name}</span>
        </div>
        <p className="text-center text-sm text-neutral-400 mb-6">
          OrderDeck Fleet — επιλέξτε μέλος
        </p>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-6">
          {members === null ? (
            <div className="text-sm text-neutral-400 text-center py-6">Φόρτωση μελών...</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-neutral-400 text-center py-6">Δεν υπάρχουν μέλη</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPicked(m);
                    setPin("");
                    setError(null);
                  }}
                  data-testid={`fleet-member-${m.id}`}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    picked?.id === m.id
                      ? "border-flame bg-[#4A1B27]"
                      : "border-[#723645] bg-[#2A0E14] hover:bg-[#4A1B27]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {m.role === "fleet_admin" ? (
                      <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
                    ) : (
                      <UserRound className="w-4 h-4 text-flame shrink-0" />
                    )}
                    <span className="font-semibold truncate">{m.name}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    {m.role === "fleet_admin" ? "Συντονιστής" : "Οδηγός"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {picked && (
            <form onSubmit={submit} className="space-y-3">
              <input
                autoFocus
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                data-testid="fleet-select-pin"
                className="w-full h-14 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-flame"
              />
              {error && (
                <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={busy || pin.length !== 4}
                data-testid="fleet-select-submit"
                className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
              >
                {busy ? "Είσοδος..." : `Είσοδος ως ${picked.name}`}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
