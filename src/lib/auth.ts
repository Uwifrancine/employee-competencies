import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "employee";

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
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isSupervisor: boolean;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isSupervisor, setIsSupervisor] = useState(false);

  const load = async (u: User | null) => {
    setUser(u);
    if (!u) {
      setProfile(null);
      setRoles([]);
      setIsSupervisor(false);
      setLoading(false);
      return;
    }
    const [{ data: prof }, { data: roleRows }, { count: reports }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.id),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("supervisor_id", u.id),
    ]);
    setProfile(prof as Profile | null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
    setIsSupervisor((reports ?? 0) > 0);
    setLoading(false);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    await load(data.user ?? null);
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      load(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load(session?.user ?? null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    user,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    isSupervisor,
    refresh,
  };
}
