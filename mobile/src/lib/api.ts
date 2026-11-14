import Constants from "expo-constants";
import { useAppStore } from "../store/useAppStore";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  "http://localhost:3000/api/v1";

export async function mobileApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAppStore.getState().accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}
