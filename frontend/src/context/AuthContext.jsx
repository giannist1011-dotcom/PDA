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
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
