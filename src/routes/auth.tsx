import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signUpFirstAdmin } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpFirstAdmin);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .then(({ count }) => {
        const exists = (count ?? 0) > 0;
        setHasAdmin(exists);
        if (!exists) {
          setMode("register");
          setFullName("Demo Admin");
          setEmail("admin@demo.local");
          setPassword("admin123");
        }
      });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const onLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const onRegister = async () => {
    setLoading(true);
    try {
      await signUp({ data: { email, password, fullName } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome! You are the first admin.");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="text-2xl font-semibold">Competency Manager</div>
        <div>
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Measure. Develop. Grow.
          </h1>
          <p className="mt-3 text-primary-foreground/80 max-w-md">
            Define competencies per job title, run self & supervisor evaluations, and turn gaps into development plans.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© Competency Manager</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === "login" ? "Sign in" : hasAdmin ? "Register" : "Create the first admin"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Use the credentials provided by your admin."
                : "This account will own the workspace."}
            </p>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <Button
            disabled={loading}
            onClick={mode === "login" ? onLogin : onRegister}
            className="w-full bg-accent text-accent-foreground hover:opacity-90"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>

          {hasAdmin && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-primary"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Need to create the first admin?" : "Have an account? Sign in"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
