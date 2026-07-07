import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0D0D] text-neutral-400">
        Φόρτωση...
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}
