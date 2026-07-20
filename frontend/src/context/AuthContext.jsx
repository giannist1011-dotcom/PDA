import { createContext, useContext, useEffect, useState } from "react";
import {
  apiLogin,
  apiMe,
  apiRegister,
  apiStartDemo,
  apiSelectProfile,
  apiExitProfile,
  apiGetBranding,
  setToken,
  getToken,
} from "@/lib/api";
import { setFavicon, resetFavicon } from "@/lib/favicon";
import {
  getMeCached,
  verifyPinOffline,
  rememberPinOffline,
  cacheProfilesForOffline,
  rememberStoreLoginOffline,
  verifyStoreLoginOffline,
  wipeOfflineDeviceData,
  cacheSet,
  isNetworkError,
  markServerDown,
  useOfflineStatus,
  syncQueue,
} from "@/lib/offline";

const AuthCtx = createContext(null);

// Offline σύνδεση σε προφίλ: κρατάμε profile_id + PIN ΜΟΝΟ στη μνήμη (όχι δίσκο),
// ώστε μόλις επανέλθει το δίκτυο να επαληθευτεί ξανά το session με τον server
// και να εκδοθεί κανονικό JWT με το προφίλ.
let pendingOfflineLogin = null;

// Offline σύνδεση καταστήματος (email+κωδικός): ίδια λογική — τα credentials
// μένουν ΜΟΝΟ στη μνήμη μέχρι να επανέλθει το δίκτυο και να εκδοθεί κανονικό JWT.
let pendingOfflineStoreLogin = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=authed
  const [error, setError] = useState(null);
  const [storeLogo, setStoreLogo] = useState(null); // custom λογότυπο μαγαζιού (data URL) ή null

  // Το store_logo δεν έρχεται με το /auth/me (μεγάλο blob) — το φέρνουμε μία φορά ανά λογαριασμό
  const userId = user && user !== false ? user.id : null;
  useEffect(() => {
    if (!userId) {
      setStoreLogo(null);
      return;
    }
    let alive = true;
    apiGetBranding()
      .then((b) => alive && setStoreLogo(b.logo || null))
      .catch(() => alive && setStoreLogo(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Dynamic favicon: λογότυπο μαγαζιού όσο υπάρχει, OrderDeck default αλλιώς/στο logout
  useEffect(() => {
    if (!storeLogo) return undefined;
    setFavicon(storeLogo);
    return () => resetFavicon();
  }, [storeLogo]);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setUser(false);
        return;
      }
      try {
        // Offline-aware: αν το δίκτυο πέσει, γυρνά το cached προφίλ αντί για logout
        const me = await getMeCached();
        setUser(me);
      } catch {
        setToken(null);
        setUser(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const { token, user: u } = await apiLogin({ email, password });
      setToken(token);
      setUser(u);
      pendingOfflineStoreLogin = null;
      cacheSet("me", u);
      cacheProfilesForOffline(); // ώστε η επιλογή προφίλ + PIN να δουλεύει και offline
      // Η σύνδεση επαληθεύτηκε online — αποθήκευσε τοπικό hash για offline είσοδο
      rememberStoreLoginOffline(email, password, u);
      return u;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Χωρίς δίκτυο: τοπική επαλήθευση πάνω στα cached credentials της συσκευής
      markServerDown();
      const cachedUser = await verifyStoreLoginOffline(email, password);
      if (cachedUser === null) {
        const err = new Error(
          "Απαιτείται σύνδεση στο διαδίκτυο για την πρώτη είσοδο σε αυτή τη συσκευή"
        );
        err.offline = true;
        throw err;
      }
      if (cachedUser === false) {
        const err = new Error("Λάθος email ή κωδικός");
        err.offline = true;
        throw err;
      }
      const me = { ...cachedUser, offline_session: true };
      delete me.role;
      delete me.profile;
      delete me.profile_id;
      delete me.profile_name; // ο ρόλος ορίζεται από την επιλογή προφίλ + PIN (offline path)
      cacheSet("me", me); // ώστε reload χωρίς δίκτυο να κρατά το session
      pendingOfflineStoreLogin = { email, password };
      setUser(me);
      return me;
    }
  };

  const register = async (payload) => {
    setError(null);
    const { token, user: u } = await apiRegister(payload);
    setToken(token);
    setUser(u);
    return u;
  };

  const startDemo = async (payload) => {
    setError(null);
    const { token, user: u } = await apiStartDemo(payload);
    setToken(token); // token already carries the Ιδιοκτήτης profile → straight into the app
    setUser(u);
    return u;
  };

  // Απλή αποσύνδεση: τα offline δεδομένα της συσκευής (credentials/PIN hashes,
  // cache, ουρά) ΔΙΑΤΗΡΟΥΝΤΑΙ ώστε το offline login να δουλεύει μετά.
  const logout = () => {
    pendingOfflineLogin = null;
    pendingOfflineStoreLogin = null;
    setToken(null);
    setUser(false);
  };

  // Ρητή ενέργεια "Αποσύνδεση & διαγραφή δεδομένων συσκευής": πλήρες reset —
  // σβήνει credentials, PIN hashes, cache και ουρά offline παραγγελιών.
  const logoutAndWipe = async () => {
    logout();
    await wipeOfflineDeviceData();
  };

  const selectProfile = async (profileId, pin) => {
    try {
      const { token, must_change_pin } = await apiSelectProfile(profileId, pin);
      setToken(token);
      pendingOfflineLogin = null;
      const me = await getMeCached();
      setUser(me);
      cacheProfilesForOffline(); // ανανέωση cache για μελλοντική offline σύνδεση
      // Το PIN επαληθεύτηκε online — αποθήκευσε τοπικό hash για offline είσοδο
      rememberPinOffline(profileId, pin, { name: me.profile_name, role: me.role });
      return { ...me, must_change_pin: !!must_change_pin };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Χωρίς δίκτυο: τοπική επαλήθευση PIN πάνω στα cached hashes
      markServerDown();
      const verified = await verifyPinOffline(profileId, pin);
      if (verified === null) {
        throw new Error(
          "Απαιτείται σύνδεση στο διαδίκτυο για την πρώτη είσοδο σε αυτή τη συσκευή"
        );
      }
      if (verified === false) throw new Error("Λάθος κωδικός");
      const base = user && user !== false ? user : {};
      const me = {
        ...base,
        role: verified.role,
        profile: verified.role,
        profile_id: verified.id,
        profile_name: verified.name,
        offline_session: true,
      };
      cacheSet("me", me); // ώστε reload χωρίς δίκτυο να κρατά το προφίλ
      pendingOfflineLogin = { profileId, pin };
      setUser(me);
      return me;
    }
  };

  // Μόλις επανέλθει η σύνδεση (είτε το online event είτε επιτυχές ping του server
  // από το OfflineBanner), επαλήθευσε ξανά το offline session με τον server
  const { offline } = useOfflineStatus();
  useEffect(() => {
    const revalidate = async () => {
      // Πρώτα το store-level login: χωρίς αυτό δεν υπάρχει καν token
      if (pendingOfflineStoreLogin) {
        try {
          const { email, password } = pendingOfflineStoreLogin;
          const { token, user: u } = await apiLogin({ email, password });
          setToken(token);
          rememberStoreLoginOffline(email, password, u); // ανανέωση hash + snapshot
          pendingOfflineStoreLogin = null;
          if (!pendingOfflineLogin) {
            setUser(u);
            cacheSet("me", u);
            cacheProfilesForOffline();
            syncQueue();
          }
        } catch (e) {
          if (isNetworkError(e)) return; // το δίκτυο ξανάπεσε — retry στο επόμενο online
          // Ο server αρνήθηκε (π.χ. άλλαξε ο κωδικός εν τω μεταξύ) → πλήρες logout
          pendingOfflineStoreLogin = null;
          pendingOfflineLogin = null;
          setToken(null);
          setUser(false);
          return;
        }
      }
      if (!pendingOfflineLogin) return;
      try {
        const { token } = await apiSelectProfile(
          pendingOfflineLogin.profileId,
          pendingOfflineLogin.pin
        );
        setToken(token);
        rememberPinOffline(pendingOfflineLogin.profileId, pendingOfflineLogin.pin, {});
        pendingOfflineLogin = null;
        const me = await apiMe();
        setUser(me);
        cacheSet("me", me);
        cacheProfilesForOffline();
        syncQueue(); // τώρα που το token έχει προφίλ, ανέβασε τυχόν ουρά παραγγελιών
      } catch (e) {
        // Ο server αρνήθηκε (π.χ. άλλαξε το PIN εν τω μεταξύ) → πίσω στην επιλογή προφίλ
        if (!isNetworkError(e)) {
          pendingOfflineLogin = null;
          try {
            const me = await apiMe();
            setUser(me);
            cacheSet("me", me);
          } catch {
            /* το δίκτυο ξανάπεσε — θα ξαναδοκιμάσει στο επόμενο online */
          }
        }
      }
    };
    if (!offline) revalidate();
    window.addEventListener("online", revalidate);
    return () => window.removeEventListener("online", revalidate);
  }, [offline]);

  const exitProfile = async () => {
    try {
      const { token } = await apiExitProfile();
      setToken(token);
      pendingOfflineLogin = null;
      const me = await apiMe();
      setUser(me);
      return me;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Offline: καθάρισε το προφίλ μόνο τοπικά — το store token μένει ως έχει
      markServerDown();
      pendingOfflineLogin = null;
      const base = user && user !== false ? { ...user } : {};
      delete base.role;
      delete base.profile;
      delete base.profile_id;
      delete base.profile_name;
      delete base.offline_session;
      cacheSet("me", base);
      setUser(base);
      return base;
    }
  };

  const refreshMe = async () => {
    const me = await apiMe();
    setUser(me);
    return me;
  };

  const role = user && user !== false ? user.role || user.profile : null;
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";
  const isWaiter = role === "waiter";
  const canManage = isOwner || isManager; // owner + Υπεύθυνος
  const profileName = user && user !== false ? user.profile_name : null;
  const hasProfile = !!role;

  return (
    <AuthCtx.Provider
      value={{
        user,
        error,
        login,
        register,
        startDemo,
        logout,
        logoutAndWipe,
        selectProfile,
        exitProfile,
        refreshMe,
        role,
        isOwner,
        isManager,
        isEmployee,
        isWaiter,
        canManage,
        profileName,
        hasProfile,
        storeLogo,
        setStoreLogo,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
