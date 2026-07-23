import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError, apiFleetExchange } from "@/lib/api";
import { setFleetToken } from "@/lib/fleetApi";
import { Button } from "@/components/ui/button";

// Λογαριασμοί χωρίς POS (εταιρείες διανομής ή μαγαζιά με πλάνο μόνο Fleet)
// προσγειώνονται στον πίνακα διανομής αντί για το ταμείο
const isFleetOnly = (u) => u?.account_type === "fleet_company" || u?.plan === "fleet";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (user && user !== false && !busy)
    return <Navigate to={isFleetOnly(user) ? "/fleet" : "/app"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success("Καλωσήρθατε!");
      if (isFleetOnly(u)) {
        try {
          const ex = await apiFleetExchange();
          setFleetToken(ex.token);
        } catch {
          // αποτυχία exchange → το /fleet θα ζητήσει σύνδεση
        }
        navigate("/fleet/select");
      } else {
        navigate("/app");
      }
    } catch (err) {
      // err.offline: μήνυμα από την τοπική (offline) επαλήθευση credentials —
      // είτε "πρώτη είσοδος απαιτεί δίκτυο" είτε "λάθος κωδικός"
      setError(
        err?.offline
          ? err.message
          : !err?.response
            ? "Δεν υπάρχει σύνδεση στο διαδίκτυο. Η πρώτη είσοδος σε αυτή τη συσκευή απαιτεί δίκτυο."
            : formatApiError(err)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center mb-8 justify-center">
          <img src="/logo-dark.svg" alt="OrderDeck" className="h-12" />
        </div>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-8">
          <h1 className="font-heading text-2xl font-bold mb-1">Σύνδεση</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Συνδεθείτε στον λογαριασμό του καταστήματός σας
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
                  data-testid="login-email"
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
                  data-testid="login-password"
                  className="w-full h-12 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
                />
              </div>
            </div>

            {error && (
              <div
                className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              data-testid="login-submit"
              className="w-full h-13 bg-brand hover:bg-brand-hover text-white font-bold text-base h-14"
            >
              {busy ? "Σύνδεση..." : "Σύνδεση"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-neutral-400 text-center">
            Δεν έχετε λογαριασμό;{" "}
            <Link to="/app/register" data-testid="go-register" className="text-flame hover:underline font-semibold">
              Εγγραφή καταστήματος
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
