import { Check, ShoppingCart, Truck } from "lucide-react";

// Επιλογή πλάνου λογαριασμού — τιμολόγηση χειροκίνητη (καμία πληρωμή στο wizard)
const PLANS = [
  {
    key: "orderdeck",
    title: "OrderDeck",
    price: "20 € / μήνα",
    badge: "1ος μήνας δωρεάν",
    desc: "Το πλήρες POS: ταμείο, τραπέζια, μενού, στατιστικά, κατάλογος.",
    icons: [ShoppingCart],
  },
  {
    key: "fleet",
    title: "OrderDeck Fleet",
    price: "30 € / μήνα έως 15 διανομείς",
    badge: "50 € / μήνα για περισσότερους",
    desc: "Μόνο διαχείριση διανομέων: πίνακας συντονιστή, οθόνη οδηγού, σύνολα ημέρας — χωρίς POS.",
    icons: [Truck],
  },
  {
    key: "orderdeck_fleet",
    title: "OrderDeck + Fleet",
    price: "POS + διαχείριση διανομέων",
    badge: "Συνδυαστική τιμολόγηση",
    desc: "Ό,τι περιλαμβάνουν και τα δύο — ταμείο και πίνακας διανομής στον ίδιο λογαριασμό.",
    icons: [ShoppingCart, Truck],
  },
];

export default function StepPlan({ form, set }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Τι χρειάζεστε;</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Επιλέξτε πλάνο — η χρέωση ενεργοποιείται χειροκίνητα, χωρίς κάρτα στην εγγραφή.
        </p>
      </div>
      {PLANS.map((p) => {
        const active = form.plan === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => set("plan", p.key)}
            data-testid={`register-plan-${p.key}`}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              active
                ? "border-flame bg-flame/10"
                : "border-[#723645] bg-[#2A0E14] hover:border-flame/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-flame">
                {p.icons.map((Icon, i) => (
                  <Icon key={i} className="w-5 h-5" />
                ))}
              </div>
              <span className="font-heading font-bold text-lg flex-1">{p.title}</span>
              {active && (
                <span className="w-6 h-6 rounded-full bg-flame flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-bold text-sm">{p.price}</span>
              <span className="text-xs text-gold font-semibold">{p.badge}</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1.5">{p.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
