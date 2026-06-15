import {
  BACKEND_API_BASE_URL,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from "./contracts";
import { requestJson } from "./http-client";

export class BackendUnavailableError extends Error {
  constructor() {
    super("登录后端尚未接入，请配置 NEXT_PUBLIC_BACKEND_API_BASE_URL。");
    this.name = "BackendUnavailableError";
  }
}

function backendUrl(path: string) {
  if (!BACKEND_API_BASE_URL) throw new BackendUnavailableError();
  return `${BACKEND_API_BASE_URL}${path}`;
}

export function getCurrentUser(signal?: AbortSignal) {
  return requestJson<AuthResponse>(backendUrl("/auth/me"), {
    credentials: "include",
    signal,
  });
}

export function login(payload: LoginRequest, signal?: AbortSignal) {
  return requestJson<AuthResponse>(backendUrl("/auth/login"), {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
  });
}

export function register(payload: RegisterRequest, signal?: AbortSignal) {
  return requestJson<AuthResponse>(backendUrl("/auth/register"), {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
  });
}

export function logout(signal?: AbortSignal) {
  return requestJson<void>(backendUrl("/auth/logout"), {
    method: "POST",
    credentials: "include",
    signal,
  });
}
