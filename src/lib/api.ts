const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (char: string) => `_${char.toLowerCase()}`);
}

function transformKeys(value: unknown, transform: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeys(item, transform));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, child]) => {
        acc[transform(key)] = transformKeys(child, transform);
        return acc;
      },
      {},
    );
  }

  return value;
}

function normalizeResponse<T>(value: unknown): T {
  return transformKeys(value, toCamelCase) as T;
}

function normalizeRequest(value: unknown): unknown {
  return transformKeys(value, toSnakeCase);
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("auth_user");
  return raw ? JSON.parse(raw) : null;
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  mustChangePassword: boolean;
  jobTitle?: { id: string; name: string } | null;
  supervisor?: { id: string; fullName: string } | null;
  subordinateCount?: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const body = init.body === undefined
    ? undefined
    : typeof init.body === "string"
      ? init.body
      : JSON.stringify(normalizeRequest(init.body));

  const res = await fetch(`${BASE}${path}`, { ...init, body, headers });

  if (res.status === 401 && token) {
    clearToken();
    window.location.href = "/auth";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  return normalizeResponse<T>(JSON.parse(text));
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
