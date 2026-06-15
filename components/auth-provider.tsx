"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthUser, LoginRequest, RegisterRequest } from "../lib/contracts";
import {
  BackendUnavailableError,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from "../lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  message: string | null;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const controller = new AbortController();

    try {
      const response = await getCurrentUser(controller.signal);
      setUser(response.user);
      setStatus("authenticated");
      setMessage(null);
    } catch (error) {
      setUser(null);
      if (error instanceof BackendUnavailableError) {
        setStatus("unavailable");
        setMessage(error.message);
      } else {
        setStatus("anonymous");
        setMessage(null);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      message,
      async login(payload) {
        const response = await loginRequest(payload);
        setUser(response.user);
        setStatus("authenticated");
        setMessage(null);
      },
      async register(payload) {
        const response = await registerRequest(payload);
        setUser(response.user);
        setStatus("authenticated");
        setMessage(null);
      },
      async logout() {
        await logoutRequest();
        setUser(null);
        setStatus("anonymous");
      },
      refresh,
    }),
    [message, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
