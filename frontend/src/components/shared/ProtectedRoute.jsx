import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/shared/AuthContext";
import { can } from "@/lib/perms";
import { hasFleetStore, hasPOS } from "@/lib/plans";

/**
 * roles: optional array of allowed roles (e.g. ["owner", "manager"]).
 * requireOwner is kept as a shorthand for roles={["owner"]}.
 * perm: optional per-profile feature key (lib/perms.js) — restrict-only.
 * requiresAI: page needs the account's ai_features_enabled flag.
 * Without either, any selected profile can enter.
 */
export default function ProtectedRoute({
  children,
  requireOwner = false,
  roles = null,
  perm = null,
  requiresAI = false,
}) {
  const { user, hasProfile, role } = useAuth();
  const { pathname } = useLocation();
  // Όσο εκκρεμεί το /auth/me το branded StartupOverlay (App.js) καλύπτει την οθόνη
  if (user === null) return null;
  if (user === false) return <Navigate to="/app/login" replace />;
  // Εταιρείες διανομής (fleet_company) → ο δικός τους πίνακας FleetDeck
  if (user.account_type === "fleet_company") return <Navigate to="/fleet" replace />;
  if (!hasProfile) return <Navigate to="/app/select-profile" replace />;
  // GATING ΑΝΑ ΠΛΑΝΟ (lib/plans.js) — ίδιος κανόνας με το μενού/τις καρτέλες:
  //   · πλάνο «fleet»: χωρίς POS, μόνο οι σελίδες /app/fleet/*
  //   · πλάνο «orderdeck»: καθαρό POS — καμία σελίδα /app/fleet/*
  const isFleetPath = pathname.startsWith("/app/fleet");
  if (!hasPOS(user) && !isFleetPath) return <Navigate to="/app/fleet" replace />;
  if (isFleetPath && !hasFleetStore(user)) return <Navigate to="/app" replace />;
  const allowed = requireOwner ? ["owner"] : roles;
  if (allowed && !allowed.includes(role)) {
    // waiters have no access to the cash PDA — their home is the tables page
    return <Navigate to={role === "waiter" ? "/app/tables" : "/app"} replace />;
  }
  if (perm && !can(user, perm)) return <Navigate to="/app" replace />;
  if (requiresAI && !user.ai_features_enabled) return <Navigate to="/app" replace />;
  return children;
}
