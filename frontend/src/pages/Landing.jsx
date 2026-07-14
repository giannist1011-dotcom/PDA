import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Utensils,
  Printer,
  LayoutGrid,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Users,
  Wallet,
  ShieldCheck,
  Check,
  ChevronDown,
  FileQuestion,
  Shuffle,
  EyeOff,
  ArrowRight,
  Sparkles,
  Tag,
  Clapperboard,
  X,
} from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/business";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

/* ---------- Data ---------- */

const FEATURES = [
  { icon: Printer, title: "Γρήγορο ταμείο & εκτύπωση", desc: "Παραγγελία σε δευτερόλεπτα, απόδειξη στον θερμικό εκτυπωτή με ένα tap." },
  { icon: LayoutGrid, title: "Τραπέζια & σερβιτόροι", desc: "Ανοιχτές καρτέλες ανά τραπέζι, μεταφορές, προφίλ σερβιτόρων." },
  { icon: BarChart3, title: "Στατιστικά & σύγκριση περιόδων", desc: "Τζίρος, best sellers, σύγκριση με χθες, πέρσι, ό,τι θες." },
  { icon: ClipboardList, title: "Ελλείψεις & λίστα αγορών", desc: "Σημείωσε τι τελείωσε, πάρε έτοιμη λίστα για τον προμηθευτή." },
  { icon: CalendarDays, title: "Πρόγραμμα υπαλλήλων", desc: "Βάρδιες ανά εβδομάδα, ορατές από όλη την ομάδα." },
  { icon: Users, title: "Ιστορικό & πελατολόγιο", desc: "Κάθε παραγγελία καταγράφεται — τηλέφωνα και διευθύνσεις πελατών στο χέρι." },
  { icon: Wallet, title: "Έξοδα & καθαρό αποτέλεσμα", desc: "Πέρνα τα έξοδα και δες τι πραγματικά σου μένει στο τέλος του μήνα." },
  { icon: ShieldCheck, title: "Ρόλοι & PIN ασφάλεια", desc: "Ιδιοκτήτης, υπεύθυνος, υπάλληλος, σερβιτόρος — καθένας βλέπει μόνο ό,τι πρέπει." },
];

const PROBLEMS = [
  { icon: FileQuestion, title: "Χαμένα χαρτάκια", desc: "Παραγγελίες σε χαρτάκια που σβήνουν, σκίζονται ή απλά… εξαφανίζονται." },
  { icon: Shuffle, title: "Μπερδεμένες παραγγελίες", desc: "Efood, τηλέφωνο, ταμείο, τραπέζια — τέσσερα κανάλια, κανένα σύστημα." },
  { icon: EyeOff, title: "Τύφλα στα νούμερα", desc: "Πόσα έκανες την Τρίτη; Ποιο προϊόν σέρνει; Κανείς δεν ξέρει στα σίγουρα." },
];

const PRICING_FEATURES = [
  "PDA ταμείου με εκτύπωση αποδείξεων",
  "Τραπέζια, καρτέλες & σερβιτόροι",
  "Στατιστικά & σύγκριση περιόδων",
  "Ελλείψεις & λίστα αγορών",
  "Πρόγραμμα υπαλλήλων",
  "Ιστορικό παραγγελιών & πελατολόγιο",
  "Έξοδα & καθαρό αποτέλεσμα",
  "Απεριόριστα προφίλ με ρόλους & PIN",
];

const FAQS = [
  {
    q: "Χρειάζομαι ειδικό εξοπλισμό;",
    a: "Όχι. Το OrderDeck τρέχει στον browser — δουλεύει σε tablet, κινητό ή υπολογιστή που ήδη έχεις. Για αποδείξεις αρκεί ένας απλός θερμικός εκτυπωτής.",
  },
  {
    q: "Δουλεύει σε tablet;",
    a: "Ναι — είναι σχεδιασμένο πρώτα για tablet και κινητό. Μεγάλα κουμπιά, γρήγορη πλοήγηση, ιδανικό για χρήση πάνω στο ταμείο ή στο πάσο.",
  },
  {
    q: "Τι γίνεται μετά τον δωρεάν μήνα;",
    a: "Ο πρώτος μήνας είναι εντελώς δωρεάν, χωρίς κάρτα. Μετά, η συνδρομή είναι 20 € / μήνα. Αν δεν συνεχίσεις, τα δεδομένα σου δεν χάνονται — απλά παγώνει η πρόσβαση μέχρι να επανέλθεις.",
  },
  {
    q: "Μπορώ να ακυρώσω όποτε θέλω;",
    a: "Ναι, όποτε θες, χωρίς δεσμεύσεις και χωρίς κρυφές χρεώσεις. Η συνδρομή είναι μήνα-μήνα.",
  },
  {
    q: "Λειτουργεί χωρίς ίντερνετ;",
    a: "Χρειάζεται σύνδεση στο ίντερνετ (WiFi ή 4G). Λειτουργία offline με αυτόματο συγχρονισμό είναι στα άμεσα σχέδιά μας.",
  },
  {
    q: "Πόσο δύσκολο είναι το στήσιμο;",
    a: "Καθόλου. Διαλέγεις τον τύπο της επιχείρησής σου (σουβλατζίδικο, καφετέρια, πιτσαρία, burger) και ξεκινάς με έτοιμο μενού που προσαρμόζεις στα δικά σου προϊόντα και τιμές.",
  },
];

/* ---------- Small pieces ---------- */

function Logo({ size = "md" }) {
  const box = size === "lg" ? "w-11 h-11 rounded-xl" : "w-9 h-9 rounded-lg";
  const icon = size === "lg" ? "w-6 h-6" : "w-5 h-5";
  const text = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} bg-gradient-to-br from-[#A62B3E] to-[#6E1B28] flex items-center justify-center shadow-lg shadow-black/40`}>
        <Utensils className={`${icon} text-white`} />
      </div>
      <span className={`font-heading ${text} font-extrabold tracking-tight text-white`}>
        Order<span className="text-flame">Deck</span>
      </span>
    </div>
  );
}

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
      {eyebrow && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          {eyebrow}
        </div>
      )}
      <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-white leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-neutral-400 text-base md:text-lg">{sub}</p>}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#333] rounded-xl bg-[#141414] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-white text-sm md:text-base">{q}</span>
        <ChevronDown className={`w-5 h-5 text-flame shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm md:text-base text-neutral-400 leading-relaxed">{a}</div>}
    </div>
  );
}

function MockupFrame({ label, children }) {
  return (
    <div className="rounded-2xl border border-[#3a3a3a] bg-[#161616] shadow-2xl shadow-black/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 h-9 bg-[#1f1f1f] border-b border-[#333]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-gold" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] text-neutral-500 font-mono truncate">orderdeck · {label}</span>
      </div>
      <div className="aspect-[4/3] p-4">{children}</div>
    </div>
  );
}

/* Placeholder screenshot content — swapped for real screenshots later */
function PlaceholderPDA() {
  return (
    <div className="h-full flex gap-2">
      <div className="flex-1 grid grid-cols-3 gap-1.5 content-start">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`h-10 rounded-md ${i === 1 ? "bg-flame/30" : "bg-[#262626]"}`} />
        ))}
      </div>
      <div className="w-1/3 flex flex-col gap-1.5">
        <div className="flex-1 rounded-md bg-[#262626]" />
        <div className="h-8 rounded-md bg-brand" />
      </div>
    </div>
  );
}

function PlaceholderTables() {
  return (
    <div className="h-full grid grid-cols-4 gap-2 content-start">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-lg border-2 ${
            i % 3 === 0 ? "bg-flame/15 border-flame/50" : "bg-[#00E676]/10 border-[#00E676]/30"
          }`}
        />
      ))}
    </div>
  );
}

function PlaceholderStats() {
  const bars = [35, 60, 45, 80, 55, 95, 70];
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-md bg-[#262626] p-2">
            <div className={`h-2 w-8 rounded-sm ${i === 0 ? "bg-gold/60" : "bg-[#3a3a3a]"}`} />
            <div className="h-3 w-12 rounded-sm bg-[#3a3a3a] mt-1.5" />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-2 px-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-flame/80" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Demo modal ---------- */

function DemoModal({ open, onClose }) {
  const navigate = useNavigate();
  const { startDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("souvlaki");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const inputCls =
    "mt-1 w-full h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-flame";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Εισάγετε έγκυρο email");
    if (!name.trim()) return setError("Εισάγετε όνομα επιχείρησης");
    setBusy(true);
    try {
      await startDemo({ email: email.trim(), business_name: name.trim(), business_type: type });
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="demo-modal"
    >
      <div className="w-full max-w-md bg-[#141414] border border-[#333] rounded-2xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-flame/15 border border-flame/30 flex items-center justify-center shrink-0">
              <Clapperboard className="w-5 h-5 text-flame" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-extrabold leading-tight">Δοκιμαστικό demo</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Μπες κατευθείαν — χωρίς εγγραφή, χωρίς κωδικό</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="demo-modal-close"
            className="w-9 h-9 rounded-lg border border-[#333] hover:border-flame flex items-center justify-center text-neutral-400 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              data-testid="demo-email"
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
              Όνομα επιχείρησης
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Ο Λευτέρης"
              data-testid="demo-business-name"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
              Τύπος επιχείρησης
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {BUSINESS_TYPES.map((b) => {
                const Icon = b.icon;
                const active = type === b.key;
                return (
                  <button
                    type="button"
                    key={b.key}
                    onClick={() => setType(b.key)}
                    data-testid={`demo-biz-${b.key}`}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      active
                        ? "bg-flame/10 border-flame text-white"
                        : "bg-[#1b1b1b] border-[#333] text-neutral-300 hover:border-flame"
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-lg bg-flame/15 flex items-center justify-center shrink-0 ${
                        active ? "" : "opacity-70"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-flame" />
                    </span>
                    <span className="text-sm font-bold">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              className="text-sm text-[#FF6961] bg-[#FF3B30]/10 border border-[#FF3B30]/40 rounded-lg p-3"
              data-testid="demo-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="demo-submit"
            className="w-full h-14 rounded-xl bg-flame hover:bg-[#EA580C] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-flame/25 transition-all disabled:opacity-50"
          >
            {busy ? "Δημιουργία demo..." : (<>Ξεκίνα το demo <ArrowRight className="w-5 h-5" /></>)}
          </button>

          <p className="text-xs text-center text-neutral-500 leading-relaxed" data-testid="demo-warning">
            🎬 Ο δοκιμαστικός λογαριασμός διαγράφεται αυτόματα μετά από 3 ώρες.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function Landing() {
  const navigate = useNavigate();
  const [promo, setPromo] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);

  const goRegister = () => {
    const code = promo.trim();
    navigate(code ? `/app/register?promo=${encodeURIComponent(code)}` : "/app/register");
  };

  const scrollToFeatures = () =>
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0D0D0D]/85 backdrop-blur-md border-b border-[#262626]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              to="/app/login"
              data-testid="landing-login-link"
              className="h-10 px-4 rounded-lg border border-[#333] hover:border-flame text-sm font-semibold flex items-center transition-colors"
            >
              Σύνδεση
            </Link>
            <button
              onClick={goRegister}
              data-testid="landing-header-cta"
              className="hidden sm:flex h-10 px-4 rounded-lg bg-flame hover:bg-[#EA580C] text-white text-sm font-bold items-center transition-colors"
            >
              Δοκίμασέ το δωρεάν
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4a1019] via-[#2a0a10] to-[#0D0D0D]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 md:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs md:text-sm font-bold uppercase tracking-widest mb-6">
            <Sparkles className="w-4 h-4" />
            Το πιλοτήριο του καταστήματός σου
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight max-w-3xl mx-auto">
            Όλο το μαγαζί σου,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flame via-[#FB923C] to-gold">
              σε μία οθόνη.
            </span>
          </h1>
          <p className="mt-5 text-base md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed">
            POS ταμείου, παραγγελίες, τραπέζια και στατιστικά — ένα σύστημα φτιαγμένο για την ελληνική
            εστίαση, από σουβλατζίδικο μέχρι καφετέρια.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <button
              onClick={goRegister}
              data-testid="landing-hero-cta"
              className="w-full sm:w-auto h-14 px-8 rounded-xl bg-flame hover:bg-[#EA580C] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-flame/25 transition-all hover:scale-[1.02]"
            >
              Δοκίμασε δωρεάν 1 μήνα
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDemoOpen(true)}
              data-testid="landing-hero-demo"
              className="w-full sm:w-auto h-14 px-8 rounded-xl bg-[#1b1b1b] border border-gold/50 hover:border-gold text-gold font-bold text-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Clapperboard className="w-5 h-5" />
              Δοκίμασε το demo
            </button>
            <button
              onClick={scrollToFeatures}
              data-testid="landing-hero-secondary"
              className="w-full sm:w-auto h-14 px-8 rounded-xl border border-[#444] hover:border-neutral-300 text-neutral-200 font-semibold text-lg flex items-center justify-center transition-colors"
            >
              Δες πώς δουλεύει
            </button>
          </div>
          <div className="mt-4 text-xs md:text-sm text-neutral-500">
            Χωρίς κάρτα · Χωρίς δέσμευση · Έτοιμο μενού σε 2 λεπτά · Το demo σβήνει σε 3 ώρες
          </div>
        </div>
      </section>

      {/* 2. PROBLEM / SOLUTION */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <SectionTitle
          title="Σου θυμίζει κάτι;"
          sub="Τρία προβλήματα που έχει κάθε κατάστημα εστίασης — και πώς τα λύνει το OrderDeck."
        />
        <div className="grid sm:grid-cols-3 gap-4">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-[#333] bg-[#141414] p-6">
              <div className="w-11 h-11 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-[#FF6961]" />
              </div>
              <h3 className="font-heading font-bold text-lg mb-1.5">{p.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#6E1B28] to-[#8E2434] border border-[#A62B3E] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Check className="w-6 h-6 text-gold" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-xl mb-1">Ένα σύστημα, μηδέν χάος.</h3>
            <p className="text-sm md:text-base text-white/80 leading-relaxed">
              Κάθε παραγγελία — ταμείο, τηλέφωνο, τραπέζι — μπαίνει στο ίδιο σύστημα, τυπώνεται σωστά και
              καταγράφεται. Στο τέλος της μέρας ξέρεις ακριβώς τι πούλησες, τι ξόδεψες και τι σου έμεινε.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24 scroll-mt-20">
        <SectionTitle
          eyebrow="Χαρακτηριστικά"
          title="Ό,τι χρειάζεται το μαγαζί σου"
          sub="Από το πρώτο χτύπημα στο ταμείο μέχρι το κλείσιμο της ημέρας."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-[#333] bg-[#141414] p-6 hover:border-flame/60 hover:bg-[#181310] transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-flame/10 border border-flame/25 flex items-center justify-center mb-4 group-hover:bg-flame/20 transition-colors">
                <f.icon className="w-5 h-5 text-flame" />
              </div>
              <h3 className="font-heading font-bold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SCREENSHOTS */}
      <section className="relative py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2a0a10]/60 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6">
          <SectionTitle
            eyebrow="Μέσα στην εφαρμογή"
            title="Σχεδιασμένο για γρήγορα χέρια"
            sub="Dark mode, μεγάλα κουμπιά, μηδέν περιττά κλικ — γιατί την ώρα της κίνησης δεν έχεις χρόνο για χάσιμο."
          />
          <div className="grid md:grid-cols-3 gap-5">
            <MockupFrame label="Ταμείο PDA">
              <PlaceholderPDA />
            </MockupFrame>
            <MockupFrame label="Τραπέζια">
              <PlaceholderTables />
            </MockupFrame>
            <MockupFrame label="Στατιστικά">
              <PlaceholderStats />
            </MockupFrame>
          </div>
        </div>
      </section>

      {/* 5. BUSINESS TYPES */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <SectionTitle
          eyebrow="Presets"
          title="Έτοιμο μενού για κάθε είδος επιχείρησης"
          sub="Διάλεξε τον τύπο σου στην εγγραφή και ξεκίνα με προφορτωμένο μενού — το προσαρμόζεις όπως θες."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BUSINESS_TYPES.map((b) => (
            <div
              key={b.key}
              className="rounded-2xl border border-[#333] bg-[#141414] p-6 flex flex-col items-center text-center hover:border-gold/50 transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-flame/10 border border-flame/25 flex items-center justify-center mb-3">
                <b.icon className="w-7 h-7 text-flame" />
              </div>
              <span className="font-heading font-bold">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6. PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24 scroll-mt-20">
        <SectionTitle
          eyebrow="Τιμή"
          title="Ένα πλάνο. Όλα μέσα."
          sub="Χωρίς κρυφές χρεώσεις, χωρίς «premium» κλειδωμένα features."
        />
        <div className="max-w-md mx-auto">
          <div className="relative rounded-3xl border border-[#A62B3E] bg-gradient-to-b from-[#3d0d16] to-[#1a0509] p-8 shadow-2xl shadow-brand/20">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gold text-black text-xs font-extrabold uppercase tracking-widest whitespace-nowrap">
              1ος μήνας ΔΩΡΕΑΝ
            </div>
            <div className="text-center mb-6 pt-2">
              <div className="font-heading text-xl font-bold text-white/90">OrderDeck Pro</div>
              <div className="mt-3 flex items-baseline justify-center gap-2">
                <span className="text-lg text-neutral-500 line-through">24,90 €</span>
                <span className="font-heading text-5xl font-extrabold text-white">20 €</span>
                <span className="text-neutral-400">/ μήνα</span>
              </div>
            </div>
            <ul className="space-y-2.5 mb-7">
              {PRICING_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/90">
                  <Check className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <label className="block mb-3">
              <span className="text-xs uppercase tracking-widest font-bold text-white/60 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Έχεις κωδικό έκπτωσης;
              </span>
              <input
                type="text"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="Προαιρετικό"
                data-testid="landing-promo-input"
                className="mt-1.5 w-full h-11 px-3 bg-black/40 border border-white/15 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
              />
            </label>
            <button
              onClick={goRegister}
              data-testid="landing-pricing-cta"
              className="w-full h-14 rounded-xl bg-flame hover:bg-[#EA580C] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-flame/30 transition-all hover:scale-[1.01]"
            >
              Ξεκίνα δωρεάν
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDemoOpen(true)}
              data-testid="landing-pricing-demo"
              className="mt-3 w-full h-12 rounded-xl border border-gold/40 hover:border-gold text-gold font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Clapperboard className="w-4 h-4" />
              Ή δοκίμασε το demo χωρίς εγγραφή
            </button>
            <div className="mt-3 text-center text-xs text-white/50">
              Χωρίς κάρτα για τον δωρεάν μήνα · Ακύρωση όποτε θες
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <SectionTitle eyebrow="FAQ" title="Συχνές ερωτήσεις" />
        <div className="space-y-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-[#262626] bg-[#0A0A0A]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo />
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <a href="#features" className="hover:text-flame transition-colors">Χαρακτηριστικά</a>
            <a href="#pricing" className="hover:text-flame transition-colors">Τιμές</a>
            <a href="mailto:hello@orderdeck.gr" className="hover:text-flame transition-colors">Επικοινωνία</a>
          </nav>
          <div className="text-xs text-neutral-600">
            © {new Date().getFullYear()} OrderDeck. Με αγάπη για την ελληνική εστίαση.
          </div>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
