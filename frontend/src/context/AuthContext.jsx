import { createContext, useContext, useEffect, useState } from "react";
import { apiLogin, apiMe, apiRegister, setToken, getToken } from "@/lib/api";

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

  const refreshMe = async () => {
    const me = await apiMe();
    setUser(me);
    return me;
  };

  return (
    <AuthCtx.Provider value={{ user, error, login, register, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
