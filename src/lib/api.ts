let memoryAuthToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  memoryAuthToken = token;
}

function getCartSessionKey(): string {
  const storageKey = "cg_cart_session";
  let val = window.sessionStorage.getItem(storageKey);
  if (!val) {
    val = `sess-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    window.sessionStorage.setItem(storageKey, val);
  }
  return val;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-cart-session", getCartSessionKey());
  if (memoryAuthToken) {
    headers.set("Authorization", `Bearer ${memoryAuthToken}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/csv")) {
    if (!res.ok) throw new Error("Export failed");
    return (await res.text()) as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}
