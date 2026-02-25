import { apiRequest } from "./api";

export const ADMIN_TOKEN_KEY = "revivepass_admin_token";

export const getAdminToken = () => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ADMIN_TOKEN_KEY);
  return value?.trim() ? value : null;
};

export const setAdminToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
};

export const clearAdminToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
};

export const getAdminHeaders = (): HeadersInit => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const verifyAdminSession = async () =>
  apiRequest<{ ok: boolean; wallet: string; expiresAt: string }>("/admin/auth/me", {
    headers: getAdminHeaders(),
  });

