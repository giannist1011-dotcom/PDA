import { Link } from "react-router-dom";
import { BellRing, CreditCard, Users, Handshake, ChevronRight } from "lucide-react";

const Chip = ({ to, icon: Icon, label, count, testid }) => (
  <Link
    to={to}
    data-testid={testid}
    className="inline-flex items-center gap-2 px-3 h-9 rounded-full bg-gold/10 border border-gold/40 text-sm font-semibold text-gold hover:bg-gold/20 transition-colors"
  >
    <Icon className="w-4 h-4" />
    <span className="font-mono font-bold">{count}</span> {label}
    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
  </Link>
);

// «Θέλουν την προσοχή σου» — κρύβεται εντελώς όταν όλα είναι μηδέν
export default function AttentionStrip({ attention }) {
  const { billing_requests, new_leads_7d, pending_partnerships } = attention || {};
  if (!billing_requests && !new_leads_7d && !pending_partnerships) return null;
  return (
    <div
      className="bg-[#3D1620] border border-[#723645] rounded-lg p-4"
      data-testid="attention-strip"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">
        <BellRing className="w-4 h-4 text-gold" /> Θέλουν την προσοχή σου
      </div>
      <div className="flex flex-wrap gap-2">
        {billing_requests > 0 && (
          <Chip
            to="/admin/shops"
            icon={CreditCard}
            label={billing_requests === 1 ? "αίτημα συνδρομής" : "αιτήματα συνδρομής"}
            count={billing_requests}
            testid="attention-billing"
          />
        )}
        {new_leads_7d > 0 && (
          <Chip
            to="/admin/leads"
            icon={Users}
            label={new_leads_7d === 1 ? "νέο demo lead (7ημ)" : "νέα demo leads (7ημ)"}
            count={new_leads_7d}
            testid="attention-leads"
          />
        )}
        {pending_partnerships > 0 && (
          <Chip
            to="/admin/fleet"
            icon={Handshake}
            label={
              pending_partnerships === 1 ? "εκκρεμές αίτημα συνεργασίας" : "εκκρεμή αιτήματα συνεργασίας"
            }
            count={pending_partnerships}
            testid="attention-partnerships"
          />
        )}
      </div>
    </div>
  );
}
