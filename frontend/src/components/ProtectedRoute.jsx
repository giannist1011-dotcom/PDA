import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * roles: optional array of allowed roles (e.g. ["owner", "manager"]).
 * requireOwner is kept as a shorthand for roles={["owner"]}.
 * Without either, any selected profile can enter.
 */
export default function ProtectedRoute({ children, requireOwner = false, roles = null }) {
  const { user, hasProfile, role } = useAuth();
  // Όσο εκκρεμεί το /auth/me το branded StartupOverlay (App.js) καλύπτει την οθόνη
  if (user === null) return null;
  if (user === false) return <Navigate to="/app/login" replace />;
  if (!hasProfile) return <Navigate to="/app/select-profile" replace />;
  const allowed = requireOwner ? ["owner"] : roles;
  if (allowed && !allowed.includes(role)) {
    // waiters have no access to the cash PDA — their home is the tables page
    return <Navigate to={role === "waiter" ? "/app/tables" : "/app"} replace />;
  }
  return children;
}
