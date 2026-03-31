import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { runStartupAlerts } from "../pywebview/settings.api";
import type { StartupSummary } from "../pywebview/settings.api.types";
import { getCurrentUserSession, logoutUser } from "../pywebview/user.api";
import type { UserSession } from "../pywebview/user.api.types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  session: UserSession | null;
  startupSummary: StartupSummary | null;
  isStartupSummaryVisible: boolean;
  dismissStartupSummary: () => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<UserSession | null>(null);
  const [startupSummary, setStartupSummary] = useState<StartupSummary | null>(null);
  const [isStartupSummaryVisible, setIsStartupSummaryVisible] = useState(false);
  const startupSessionKeyRef = useRef<string | null>(null);

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
      startupSessionKeyRef.current = null;
      setStartupSummary(null);
      setIsStartupSummaryVisible(false);
      setSession(null);
      setStatus("anonymous");
    }
  }, [session]);

  const dismissStartupSummary = useCallback(() => {
    setIsStartupSummaryVisible(false);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (status !== "authenticated" || !session) {
      startupSessionKeyRef.current = null;
      setStartupSummary(null);
      setIsStartupSummaryVisible(false);
      return;
    }

    const startupSessionKey =
      session.access_token || `${session.user_id}:${session.created_at}`;
    const startupUserId = session.user_id;

    if (startupSessionKeyRef.current === startupSessionKey) {
      return;
    }

    startupSessionKeyRef.current = startupSessionKey;

    let isMounted = true;

    async function runStartupCheck() {
      try {
        const response = await runStartupAlerts(startupUserId);
        if (!isMounted) return;

        const startup = response.data?.startup ?? response.startup;
        if (!response.ok || !startup || !startup.summary) {
          setStartupSummary(null);
          setIsStartupSummaryVisible(false);
          return;
        }

        setStartupSummary(startup.summary);
        setIsStartupSummaryVisible(Boolean(startup.should_show_summary));
      } catch {
        if (!isMounted) return;
        setStartupSummary(null);
        setIsStartupSummaryVisible(false);
      }
    }

    void runStartupCheck();

    return () => {
      isMounted = false;
    };
  }, [status, session]);

  const value = useMemo(
    () => ({
      status,
      session,
      startupSummary,
      isStartupSummaryVisible,
      dismissStartupSummary,
      refreshSession,
      logout,
    }),
    [
      status,
      session,
      startupSummary,
      isStartupSummaryVisible,
      dismissStartupSummary,
      refreshSession,
      logout,
    ],
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
