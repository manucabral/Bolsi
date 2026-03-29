import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";
import { getCurrentUserSession, logoutUser } from "../pywebview/user.api";
import type { UserSession } from "../pywebview/user.api.types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  session: UserSession | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<UserSession | null>(null);

  const refreshSession = useCallback(async () => {
    setStatus("loading");

    try {
      const response = await getCurrentUserSession();
      const session = response.data?.session ?? response.session;

      if (response.ok && session) {
        setSession(session);
        setStatus("authenticated");
        return;
      }

      setSession(null);
      setStatus("anonymous");
    } catch {
      setSession(null);
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(async () => {
    const accessToken = session?.access_token;

    try {
      await logoutUser(accessToken);
    } finally {
      setSession(null);
      setStatus("anonymous");
    }
  }, [session]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({ status, session, refreshSession, logout }),
    [status, session, refreshSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return context;
}
