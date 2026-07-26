import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { disablePush, enablePush, isPushEnabled, pushSupport } from "@/lib/push";

// Κουμπί ενεργοποίησης/απενεργοποίησης push ειδοποιήσεων (δίπλα στη σίγαση
// ήχου). Κοινό για οδηγό (surface="driver") και διαχείριση ("dispatcher").
// Ακούει το event "orderdeck-push-changed" ώστε η αυτόματη ενεργοποίηση στην
// έναρξη βάρδιας (FleetDriver) να ανανεώνει το εικονίδιο.
export default function PushToggle({ surface }) {
  const [on, setOn] = useState(() => isPushEnabled(surface));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isPushEnabled(surface));
    window.addEventListener("orderdeck-push-changed", sync);
    return () => window.removeEventListener("orderdeck-push-changed", sync);
  }, [surface]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush(surface);
        setOn(false);
        toast.message("Οι ειδοποιήσεις push απενεργοποιήθηκαν");
      } else {
        const support = pushSupport();
        if (!support.ok) {
          toast.message(support.reason);
          return;
        }
        await enablePush(surface);
        setOn(true);
        toast.success("Θα λαμβάνετε ειδοποιήσεις και με κλειστή την εφαρμογή");
      }
    } catch (err) {
      toast.error(err?.message || "Κάτι πήγε στραβά με τις ειδοποιήσεις");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={on ? "Απενεργοποίηση ειδοποιήσεων push" : "Ειδοποιήσεις και με κλειστή εφαρμογή"}
      data-testid={`fleet-push-toggle-${surface}`}
      className={`p-2 rounded-md hover:bg-white/5 disabled:opacity-60 ${on ? "text-gold" : "text-neutral-500"}`}
    >
      {on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  );
}
