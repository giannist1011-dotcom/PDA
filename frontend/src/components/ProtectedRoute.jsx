import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireOwner = false }) {
  const { user, hasProfile, isOwner } = useAuth();
  if (user === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0D0D] text-neutral-400">
        Φόρτωση...
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (!hasProfile) return <Navigate to="/select-profile" replace />;
  if (requireOwner && !isOwner) return <Navigate to="/" replace />;
  return children;
}
