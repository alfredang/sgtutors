import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

interface AuthState {
  tutorLoggedIn: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  tutorLoggedIn: false,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tutorLoggedIn, setTutorLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      await api.get("/api/auth/tutor/session");
      setTutorLoggedIn(true);
    } catch {
      setTutorLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await api.post("/api/auth/tutor/logout").catch(() => {});
    setTutorLoggedIn(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ tutorLoggedIn, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
