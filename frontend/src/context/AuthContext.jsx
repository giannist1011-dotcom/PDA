import { createContext, useContext, useEffect, useState } from "react";
import {
  apiLogin,
  apiMe,
  apiRegister,
  apiSelectProfile,
  apiExitProfile,
  setToken,
  getToken,
} from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=authed
  const [error, setError] = useState(null);

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

  const logout = () => {
    setToken(null);
    setUser(false);
  };

  const selectProfile = async (profile, pin) => {
    const { token } = await apiSelectProfile(profile, pin);
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

  const isOwner = user && user !== false && user.profile === "owner";
  const isEmployee = user && user !== false && user.profile === "employee";
  const hasProfile = user && user !== false && !!user.profile;

  return (
    <AuthCtx.Provider
      value={{
        user,
        error,
        login,
        register,
        logout,
        selectProfile,
        exitProfile,
        refreshMe,
        isOwner,
        isEmployee,
        hasProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
