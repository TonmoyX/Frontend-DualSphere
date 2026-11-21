// Typed API client. Auth uses HttpOnly cookies (never readable by JS);
// expired access tokens are refreshed transparently, once, with single-flight.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

type Opts = Omit<RequestInit, "body"> & { body?: unknown; retry?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    credentials: "include",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Expired access token: refresh once and retry. The server flags this with a header
  // even on public routes (otherwise they'd silently answer as "logged out").
  if (retry && (res.headers.get("x-auth-expired") === "1" || res.status === 401)) {
    const expired =
      res.headers.get("x-auth-expired") === "1" ||
      (await res.clone().json().catch(() => null))?.error?.code === "TOKEN_EXPIRED";
    if (expired && (await refreshSession())) return api<T>(path, { ...opts, retry: false });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      data?.error?.code ?? "HTTP_ERROR",
      data?.error?.message ?? `Request failed (${res.status})`,
      data?.error?.details,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ?? {} });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });

/** Keeps the session warm so access tokens rarely expire mid-use. */
export function refreshNow() {
  return refreshSession();
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
