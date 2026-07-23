import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Mail, Lock, Truck } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Σύνδεση εταιρείας διανομής (email + password) — OrderDeck Fleet branding.
export default function FleetLogin() {
  const { team, login } = useFleet();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (team && team !== false)
    return <Navigate to={team.role === "driver" ? "/fleet/driver" : "/fleet/select"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/fleet/select");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
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
          <h1 className="font-heading text-2xl font-bold mb-1">Σύνδεση</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Συνδεθείτε στον λογαριασμό της εταιρείας διανομής
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="fleet-login-email"
                  className="w-full h-12 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                Κωδικός
              </label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="fleet-login-password"
                  className="w-full h-12 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
                />
              </div>
            </div>

            {error && (
              <div
                className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]"
                data-testid="fleet-login-error"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              data-testid="fleet-login-submit"
              className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
            >
              {busy ? "Σύνδεση..." : "Σύνδεση"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-neutral-400 text-center space-y-2">
            <div>
              Νέα εταιρεία;{" "}
              <Link to="/fleet/register" data-testid="fleet-go-register" className="text-flame hover:underline font-semibold">
                Εγγραφή
              </Link>
            </div>
            <div>
              Είστε διανομέας;{" "}
              <Link to="/fleet/driver-login" data-testid="fleet-go-driver-login" className="text-gold hover:underline font-semibold">
                Είσοδος διανομέα
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
