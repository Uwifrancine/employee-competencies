import { useEffect, useState, useCallback } from "react";
import { api, getStoredUser, storeUser, clearToken, setToken, AuthUser } from "./api";

export type AppRole = "admin" | "hr" | "employee";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  job_title_id: string | null;
  supervisor_id: string | null;
  must_change_password: boolean;
}

export interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isHR: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  primaryRoleLabel: string;
  refresh: () => Promise<void>;
  logout: () => void;
}

function toProfile(u: AuthUser): Profile {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    job_title_id: u.jobTitle?.id ?? null,
    supervisor_id: u.supervisor?.id ?? null,
    must_change_password: u.mustChangePassword,
  };
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", {
    email,
    password,
  });
  setToken(res.token);
  storeUser(res.user);
  return res;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    const stored = getStoredUser();
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const fresh = await api.get<AuthUser>("/api/auth/me");
      storeUser(fresh);
      setUser(fresh);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = "/auth";
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roles = (user?.roles ?? []) as AppRole[];
  const isAdmin = roles.includes("admin");
  const isHR = roles.includes("hr");
  const isEmployee = roles.includes("employee") || (!isAdmin && !isHR);

  const isSupervisor = (user?.subordinateCount ?? 0) > 0;

  let primaryRoleLabel = "Employee";
  if (isAdmin) primaryRoleLabel = "Admin";
  else if (isHR) primaryRoleLabel = "HR";

  const profile = user ? toProfile(user) : null;

  return {
    loading,
    user,
    profile,
    roles,
    isAdmin,
    isHR,
    isSupervisor,
    isEmployee,
    primaryRoleLabel,
    refresh,
    logout,
  };
}

export function useIsSupervisor(): boolean {
  const [is, setIs] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    api
      .get<{ id: string }[]>("/api/employees?supervisorId=" + user.id)
      .then((list) => setIs(Array.isArray(list) && list.length > 0))
      .catch(() => setIs(false));
  }, [user?.id]);

  return is;
}
