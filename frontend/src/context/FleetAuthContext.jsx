import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  apiFleetMe,
  apiFleetLogin,
  apiFleetSelectMember,
  apiFleetExitMember,
  setFleetToken,
  getFleetToken,
} from "@/lib/fleetApi";

// Auth context του OrderDeck Fleet — εντελώς ανεξάρτητο από το AuthContext των
// μαγαζιών (δικό του token/session). team: undefined=φορτώνει, false=χωρίς session.
const FleetAuthContext = createContext(null);

export function FleetAuthProvider({ children }) {
  const [team, setTeam] = useState(undefined);

  useEffect(() => {
    (async () => {
      if (!getFleetToken()) {
        setTeam(false);
        return;
      }
      try {
        setTeam(await apiFleetMe());
      } catch {
        setFleetToken(null);
        setTeam(false);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setTeam(await apiFleetMe());
    } catch {
      setFleetToken(null);
      setTeam(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiFleetLogin({ email, password });
    setFleetToken(data.token);
    setTeam(await apiFleetMe());
    return data;
  }, []);

  const selectMember = useCallback(async (memberId, pin) => {
    const data = await apiFleetSelectMember(memberId, pin);
    setFleetToken(data.token);
    setTeam(await apiFleetMe());
    return data;
  }, []);

  const exitMember = useCallback(async () => {
    const data = await apiFleetExitMember();
    setFleetToken(data.token);
    setTeam(await apiFleetMe());
  }, []);

  // Είσοδος με έτοιμο token (register / join / code-select)
  const adoptToken = useCallback(async (token) => {
    setFleetToken(token);
    setTeam(await apiFleetMe());
  }, []);

  const logout = useCallback(() => {
    setFleetToken(null);
    setTeam(false);
  }, []);

  return (
    <FleetAuthContext.Provider
      value={{ team, refresh, login, selectMember, exitMember, adoptToken, logout }}
    >
      {children}
    </FleetAuthContext.Provider>
  );
}

export const useFleet = () => useContext(FleetAuthContext);

// Route guard: χωρίς session → login, χωρίς επιλεγμένο μέλος → επιλογή μέλους.
// roles: λίστα επιτρεπτών ρόλων (fleet_admin / driver).
export function FleetProtected({ roles = null, children }) {
  const { team } = useFleet();
  const location = useLocation();
  if (team === undefined) {
    return (
      <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center">
        <span className="text-neutral-400 text-sm">Φόρτωση...</span>
      </div>
    );
  }
  if (team === false) return <Navigate to="/fleet/login" replace />;
  if (!team.member_id && location.pathname !== "/fleet/select")
    return <Navigate to="/fleet/select" replace />;
  if (roles && team.role && !roles.includes(team.role)) {
    // Λάθος οθόνη για τον ρόλο → στη σωστή αρχική του
    return <Navigate to={team.role === "driver" ? "/fleet/driver" : "/fleet"} replace />;
  }
  return children;
}
