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

const AuthCtx = createContext(null);

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
        const me = await apiMe();
        setUser(me);
      } catch {
        setToken(null);
        setUser(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    setError(null);
    const { token, user: u } = await apiLogin({ email, password });
    setToken(token);
    setUser(u);
    return u;
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

  const logout = () => {
    setToken(null);
    setUser(false);
  };

  const selectProfile = async (profileId, pin) => {
    const { token } = await apiSelectProfile(profileId, pin);
    setToken(token);
    const me = await apiMe();
    setUser(me);
    return me;
  };

  const exitProfile = async () => {
    const { token } = await apiExitProfile();
    setToken(token);
    const me = await apiMe();
    setUser(me);
    return me;
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
