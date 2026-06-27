import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/change-password")({
  ssr: false,
  component: ChangePassword,
});

function ChangePassword() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pwd.length < 8) return toast.error("Use at least 8 characters");
    if (pwd !== pwd2) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword: current, newPassword: pwd });
      await refresh();
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Set a new password" subtitle="You must change your temporary password before continuing." />
      <Card><CardContent className="p-5 space-y-3">
        <div><Label>Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div><Label>New password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        <div><Label>Confirm password</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} /></div>
        <Button onClick={submit} disabled={loading} className="w-full bg-accent text-accent-foreground hover:opacity-90">
          {loading ? "Saving..." : "Update password"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
