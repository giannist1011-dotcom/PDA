import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  apiFleetMe,
  apiFleetLogin,
  apiFleetSelectMember,
  apiFleetExitMember,
  setFleetToken,
  getFleetToken,
  setFleetSurface,
  fleetTokenSurface,
  hasFleetSession,
} from "@/lib/fleetApi";

// Auth context του OrderDeck Fleet — εντελώς ανεξάρτητο από το AuthContext των
// μαγαζιών. Δύο ΕΠΙΦΑΝΕΙΕΣ με ξεχωριστά sessions (ξεχωριστά κλειδιά storage):
// driver PWA (/fleet/driver*) και dashboard συντονιστή (υπόλοιπα /fleet) —
// login στη μία δεν πατάει ποτέ το session της άλλης στον ίδιο browser.
// team: undefined=φορτώνει, false=χωρίς session.
const FleetAuthContext = createContext(null);

const surfaceOfPath = (pathname) =>
  pathname.startsWith("/fleet/driver") ? "driver" : "fleet_admin";

// Ταιριάζει ο ρόλος του session στην επιφάνεια; (null ρόλος = team-level login,
// επιτρεπτός μόνο στο dashboard όπου οδηγεί σε επιλογή μέλους)
const roleMatchesSurface = (surface, role) =>
  surface === "driver" ? role === "driver" : role !== "driver";

export function FleetAuthProvider({ children }) {
  const { pathname } = useLocation();
  const surface = surfaceOfPath(pathname);
  // Ορίζεται ΚΑΤΑ το render (idempotent) ώστε κάθε κλήση API των children —
  // ακόμα και στο πρώτο mount — να διαβάσει το κλειδί της σωστής επιφάνειας
  setFleetSurface(surface);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;

  const [team, setTeam] = useState(undefined);

  // (Επανα)φόρτωση session επιφάνειας: token → /fleet/me → έλεγχος ρόλου.
  // Σε mismatch καθαρίζει το κλειδί και γυρνά σε login αντί να δείξει λάθος ταυτότητα.
  const hydrate = useCallback(async (sfc) => {
    const t = getFleetToken();
    if (!t || fleetTokenSurface(t) !== sfc) {
      if (t) setFleetToken(null);
      setTeam(false);
      return;
    }
    try {
      const me = await apiFleetMe();
      if (!roleMatchesSurface(sfc, me.role || null)) {
        // π.χ. ο ρόλος του μέλους άλλαξε server-side όσο ζούσε το token
        setFleetToken(null);
        setTeam(false);
        return;
      }
      setTeam(me);
    } catch {
      setFleetToken(null);
      setTeam(false);
    }
  }, []);

  useEffect(() => {
    setTeam(undefined);
    hydrate(surface);
  }, [surface, hydrate]);

  const refresh = useCallback(() => hydrate(surfaceRef.current), [hydrate]);

  const login = useCallback(
    async (email, password) => {
      const data = await apiFleetLogin({ email, password });
      setFleetToken(data.token);
      await hydrate(surfaceRef.current);
      return data;
    },
    [hydrate]
  );

  const selectMember = useCallback(async (memberId, pin) => {
    const data = await apiFleetSelectMember(memberId, pin);
    // Κλειδί κατά ρόλο του token: οδηγός με PIN → driver key, το team session
    // του dashboard μένει άθικτο. Το state ενημερώνεται μόνο αν το νέο session
    // ανήκει στην τρέχουσα επιφάνεια — αλλιώς το navigate θα το φορτώσει εκεί.
    setFleetToken(data.token);
    if (roleMatchesSurface(surfaceRef.current, data.role || null)) {
      setTeam(await apiFleetMe(data.token));
    }
    return data;
  }, []);

  const exitMember = useCallback(async () => {
    const data = await apiFleetExitMember();
    if (surfaceRef.current === "fleet_admin") {
      setFleetToken(data.token); // αντικατάσταση με team-level token στο ίδιο κλειδί
      setTeam(await apiFleetMe(data.token));
      return;
    }
    // Driver επιφάνεια: καθάρισε ΜΟΝΟ το driver session. Το team token γράφεται
    // στο κλειδί dashboard μόνο αν δεν υπάρχει ήδη session εκεί (tablet ροή PIN),
    // ώστε να μην πατηθεί ενεργό session συντονιστή σε άλλο tab.
    setFleetToken(null);
    if (!hasFleetSession("fleet_admin")) setFleetToken(data.token);
    // Το navigate στο /fleet/select αλλάζει επιφάνεια και κάνει rehydrate
  }, []);

  // Είσοδος με έτοιμο token (register / join / driver select)
  const adoptToken = useCallback(async (token) => {
    setFleetToken(token);
    const me = await apiFleetMe(token);
    if (roleMatchesSurface(surfaceRef.current, me.role || null)) setTeam(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    setFleetToken(null); // μόνο το κλειδί της τρέχουσας επιφάνειας
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

// Route guard: χωρίς session → login της αντίστοιχης επιφάνειας, χωρίς
// επιλεγμένο μέλος → επιλογή μέλους. roles: λίστα επιτρεπτών ρόλων.
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
  if (team === false) {
    const loginPath = surfaceOfPath(location.pathname) === "driver"
      ? "/fleet/driver-login"
      : "/fleet/login";
    return <Navigate to={loginPath} replace />;
  }
  if (!team.member_id && location.pathname !== "/fleet/select")
    return <Navigate to="/fleet/select" replace />;
  if (roles && team.role && !roles.includes(team.role)) {
    // Λάθος οθόνη για τον ρόλο → στη σωστή αρχική του
    return <Navigate to={team.role === "driver" ? "/fleet/driver" : "/fleet"} replace />;
  }
  return children;
}
