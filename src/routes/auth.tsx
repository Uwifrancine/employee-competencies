import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, setToken, storeUser } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem("auth_token")) {
      window.location.href = "/dashboard";
      return;
    }

    // Check if a first admin needs to be seeded
    api
      .get<{ count: number }>("/api/auth/check-admin")
      .then(({ count }) => setHasAdmin(count > 0))
      .catch(() => setHasAdmin(true));
  }, [navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/api/auth/login", {
        email,
        password,
      });
      setToken(res.token);
      storeUser(res.user);
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast.error(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSeedAdmin = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ token?: string; user?: any }>("/api/auth/seed-admin");
      // After seeding, log in automatically with the temp credentials
      const loginRes = await api.post<{ token: string; user: any }>("/api/auth/login", {
        email: "admin@company.com",
        password: "Admin@1234",
      });
      setToken(loginRes.token);
      storeUser(loginRes.user);
      toast.success("Admin account created — please change your password.");
      navigate({ to: "/change-password" });
    } catch (e: any) {
      toast.error(e?.message ?? "Setup failed");
      setHasAdmin(true);
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
          {hasAdmin === false ? (
            <>
              <div>
                <h2 className="text-2xl font-bold">Create the first admin</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  No accounts exist yet. Click below to bootstrap the admin account.
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-1">
                <div><span className="font-medium">Email:</span> admin@company.com</div>
                <div><span className="font-medium">Password:</span> Admin@1234 (must change)</div>
              </div>
              <Button
                disabled={loading}
                onClick={onSeedAdmin}
                className="w-full bg-accent text-accent-foreground hover:opacity-90"
              >
                {loading ? "Setting up…" : "Create admin account"}
              </Button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-bold">Sign in</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Use the credentials provided by your admin.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className={errors.email ? "text-destructive" : ""}>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    placeholder="you@company.com"
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label className={errors.password ? "text-destructive" : ""}>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({ ...errors, password: undefined });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && onLogin()}
                      className={`pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
              </div>
              <Button
                disabled={loading}
                onClick={onLogin}
                className="w-full bg-accent text-accent-foreground hover:opacity-90"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
