import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Utensils, Mail, Lock, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (user && user !== false) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ restaurant_name: restaurantName, email, password });
      toast.success("Ο λογαριασμός δημιουργήθηκε!");
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-md bg-[#FF6B00] flex items-center justify-center">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <span className="font-heading text-3xl font-bold tracking-tight">POS Suite</span>
        </div>

        <div className="bg-[#1A1A1A] border border-[#333] rounded-lg p-8">
          <h1 className="font-heading text-2xl font-bold mb-1">Εγγραφή καταστήματος</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Δημιουργήστε τον λογαριασμό του καταστήματός σας
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                Όνομα καταστήματος
              </label>
              <div className="relative mt-1">
                <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  required
                  minLength={1}
                  maxLength={80}
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  data-testid="register-restaurant"
                  placeholder="π.χ. Ο Λευτέρης"
                  className="w-full h-12 pl-10 pr-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="register-email"
                  className="w-full h-12 pl-10 pr-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
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
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="register-password"
                  className="w-full h-12 pl-10 pr-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div className="text-xs text-neutral-500 mt-1">Τουλάχιστον 4 χαρακτήρες</div>
            </div>

            {error && (
              <div
                className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]"
                data-testid="register-error"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              data-testid="register-submit"
              className="w-full bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-base h-14"
            >
              {busy ? "Δημιουργία..." : "Δημιουργία λογαριασμού"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-neutral-400 text-center">
            Έχετε ήδη λογαριασμό;{" "}
            <Link to="/login" data-testid="go-login" className="text-[#FF6B00] hover:underline font-semibold">
              Σύνδεση
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-500 leading-relaxed">
          Θα σας δοθεί το πλήρες μενού «Πεινώκιο» ως αρχικό template — μπορείτε να το επεξεργαστείτε ελεύθερα.
        </div>
      </div>
    </div>
  );
}
