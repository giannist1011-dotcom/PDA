import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * roles: optional array of allowed roles (e.g. ["owner", "manager"]).
 * requireOwner is kept as a shorthand for roles={["owner"]}.
 * Without either, any selected profile can enter.
 */
export default function ProtectedRoute({ children, requireOwner = false, roles = null }) {
  const { user, hasProfile, role } = useAuth();
  if (user === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0D0D] text-neutral-400">
        Φόρτωση...
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (!hasProfile) return <Navigate to="/select-profile" replace />;
  const allowed = requireOwner ? ["owner"] : roles;
  if (allowed && !allowed.includes(role)) return <Navigate to="/" replace />;
  return children;
}
