import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, Phone, Lock, Building2 } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import {
  apiFleetDriverLogin,
  apiFleetDriverChangePassword,
  apiFleetDriverSelect,
} from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-12 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

// Είσοδος διανομέα με προσωπικό λογαριασμό (τηλέφωνο/email + κωδικό από την
// εταιρεία). Πρώτη είσοδος με προσωρινό κωδικό → υποχρεωτική αλλαγή (ίδιο
// pattern με το must_change_pin των προφίλ μαγαζιών) → επιλογή εταιρείας.
export default function FleetDriverLogin() {
  const { adoptToken } = useFleet();
  const navigate = useNavigate();
  const [step, setStep] = useState("login"); // login | change | pick
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [session, setSession] = useState(null); // {token, name, memberships}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const enterTeam = async (token, memberId) => {
    const data = await apiFleetDriverSelect(token, memberId);
    await adoptToken(data.token);
    navigate("/fleet/driver");
  };

  const proceed = async (s) => {
    if (s.memberships.length === 0) {
      setError("Δεν υπάρχει ενεργή συνεργασία με εταιρεία — μιλήστε με τον συντονιστή σας");
      setStep("login");
      return;
    }
    if (s.memberships.length === 1) {
      await enterTeam(s.token, s.memberships[0].member_id);
      return;
    }
    setStep("pick");
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await apiFleetDriverLogin(identifier.trim(), password);
      setSession(data);
      if (data.must_change_password) setStep("change");
      else await proceed(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitChange = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setError("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες");
      return;
    }
    if (newPw !== newPw2) {
      setError("Οι κωδικοί δεν ταιριάζουν");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await apiFleetDriverChangePassword(session.token, newPw);
      await proceed(session);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const pickTeam = async (m) => {
    setError(null);
    setBusy(true);
    try {
      await enterTeam(session.token, m.member_id);
    } catch (err) {
      setError(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Truck className="w-8 h-8 text-flame" />
          <span className="font-heading text-2xl font-bold">OrderDeck Fleet</span>
        </div>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-8">
          {step === "login" && (
            <>
              <h1 className="font-heading text-2xl font-bold mb-1">Είσοδος διανομέα</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Με τα στοιχεία που σας έδωσε η εταιρεία σας
              </p>
              <form onSubmit={submitLogin} className="space-y-4">
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    required
                    placeholder="Τηλέφωνο ή email"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    data-testid="fleet-driver-identifier"
                    className={inputCls}
                  />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="password"
                    required
                    placeholder="Κωδικός"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="fleet-driver-password"
                    className={inputCls}
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  data-testid="fleet-driver-submit"
                  className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
                >
                  {busy ? "Είσοδος..." : "Είσοδος"}
                </Button>
              </form>
              <div className="mt-6 text-sm text-neutral-400 text-center">
                Εταιρεία διανομής;{" "}
                <Link to="/fleet/login" className="text-flame hover:underline font-semibold">
                  Σύνδεση εταιρείας
                </Link>
              </div>
            </>
          )}

          {step === "change" && (
            <>
              <h1 className="font-heading text-2xl font-bold mb-1">Νέος κωδικός</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Ο προσωρινός κωδικός πρέπει να αλλάξει — ορίστε δικό σας (6+ χαρακτήρες)
              </p>
              <form onSubmit={submitChange} className="space-y-4">
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="password"
                    required
                    placeholder="Νέος κωδικός"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    data-testid="fleet-driver-newpw"
                    className={inputCls}
                  />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="password"
                    required
                    placeholder="Επιβεβαίωση κωδικού"
                    autoComplete="new-password"
                    value={newPw2}
                    onChange={(e) => setNewPw2(e.target.value)}
                    data-testid="fleet-driver-newpw2"
                    className={inputCls}
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  data-testid="fleet-driver-changepw-submit"
                  className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
                >
                  {busy ? "Αποθήκευση..." : "Αποθήκευση & είσοδος"}
                </Button>
              </form>
            </>
          )}

          {step === "pick" && (
            <>
              <h1 className="font-heading text-2xl font-bold mb-1">Επιλογή εταιρείας</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Ο λογαριασμός σας συνεργάζεται με περισσότερες από μία εταιρείες
              </p>
              <div className="space-y-3">
                {session.memberships.map((m) => (
                  <button
                    key={m.member_id}
                    type="button"
                    disabled={busy}
                    onClick={() => pickTeam(m)}
                    data-testid={`fleet-driver-team-${m.member_id}`}
                    className="w-full p-4 rounded-lg border border-[#723645] bg-[#2A0E14] hover:bg-[#4A1B27] text-left flex items-center gap-3"
                  >
                    <Building2 className="w-5 h-5 text-gold shrink-0" />
                    <div>
                      <div className="font-semibold">{m.team_name}</div>
                      {m.city && <div className="text-xs text-neutral-400">{m.city}</div>}
                    </div>
                  </button>
                ))}
              </div>
              {error && (
                <div className="mt-4 p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
