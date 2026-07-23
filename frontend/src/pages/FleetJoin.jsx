import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Truck, UserRound, UserPlus } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetCodeLookup, apiFleetJoin, apiFleetCodeSelect } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-14 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

// Είσοδος διανομέα από το κινητό: κωδικός ομάδας → επιλογή ονόματος + PIN
// (επανασύνδεση) ή δημιουργία νέου προφίλ οδηγού (όνομα + PIN).
export default function FleetJoin() {
  const { adoptToken } = useFleet();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState(null); // {team_name, city, drivers}
  const [mode, setMode] = useState(null); // "existing" (member) | "new"
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const findTeam = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setLookup(await apiFleetCodeLookup(code.trim().toUpperCase()));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const c = code.trim().toUpperCase();
      const data =
        mode === "new"
          ? await apiFleetJoin(c, name.trim(), pin)
          : await apiFleetCodeSelect(c, picked.id, pin);
      await adoptToken(data.token);
      toast.success(`Καλωσήρθατε, ${data.member_name}!`);
      navigate("/fleet/driver");
    } catch (err) {
      setError(formatApiError(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Truck className="w-8 h-8 text-flame" />
          <span className="font-heading text-2xl font-bold">OrderDeck Fleet</span>
        </div>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-6">
          {!lookup ? (
            <>
              <h1 className="font-heading text-xl font-bold mb-1">Είσοδος διανομέα</h1>
              <p className="text-sm text-neutral-400 mb-5">
                Γράψτε τον κωδικό ομάδας που σας έδωσε η εταιρεία σας
              </p>
              <form onSubmit={findTeam} className="space-y-3">
                <input
                  required
                  autoFocus
                  maxLength={12}
                  placeholder="π.χ. K4TR7X"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  data-testid="fleet-join-code"
                  className={`${inputCls} text-center text-2xl tracking-[0.35em] uppercase`}
                />
                {error && (
                  <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={busy || !code.trim()}
                  data-testid="fleet-join-lookup"
                  className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
                >
                  {busy ? "Έλεγχος..." : "Συνέχεια"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-heading text-xl font-bold mb-1">{lookup.team_name}</h1>
              <p className="text-sm text-neutral-400 mb-5">
                {lookup.city ? `${lookup.city} · ` : ""}Επιλέξτε το όνομά σας ή δημιουργήστε νέο
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {lookup.drivers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setMode("existing");
                      setPicked(d);
                      setPin("");
                      setError(null);
                    }}
                    data-testid={`fleet-join-driver-${d.id}`}
                    className={`p-4 rounded-lg border text-left ${
                      mode === "existing" && picked?.id === d.id
                        ? "border-flame bg-[#4A1B27]"
                        : "border-[#723645] bg-[#2A0E14] hover:bg-[#4A1B27]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-flame shrink-0" />
                      <span className="font-semibold truncate">{d.name}</span>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setPicked(null);
                    setPin("");
                    setError(null);
                  }}
                  data-testid="fleet-join-new"
                  className={`p-4 rounded-lg border text-left ${
                    mode === "new"
                      ? "border-flame bg-[#4A1B27]"
                      : "border-dashed border-[#723645] bg-[#2A0E14] hover:bg-[#4A1B27]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-gold shrink-0" />
                    <span className="font-semibold">Νέος οδηγός</span>
                  </div>
                </button>
              </div>

              {mode && (
                <form onSubmit={submit} className="space-y-3">
                  {mode === "new" && (
                    <input
                      required
                      autoFocus
                      maxLength={40}
                      placeholder="Το όνομά σας"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="fleet-join-name"
                      className={inputCls}
                    />
                  )}
                  <input
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder={mode === "new" ? "Επιλέξτε PIN (4 ψηφία)" : "PIN"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    data-testid="fleet-join-pin"
                    className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
                  />
                  {error && (
                    <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={busy || pin.length !== 4 || (mode === "new" && !name.trim())}
                    data-testid="fleet-join-submit"
                    className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
                  >
                    {busy ? "Είσοδος..." : "Είσοδος"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-6 text-sm text-neutral-400 text-center">
          Είστε εταιρεία;{" "}
          <Link to="/fleet/login" className="text-flame hover:underline font-semibold">
            Σύνδεση εταιρείας
          </Link>
        </div>
      </div>
    </div>
  );
}
