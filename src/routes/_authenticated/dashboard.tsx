import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Sprout, UserCheck, Briefcase, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoData } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

type DemoCred = { email: string; password: string; role: string };

function Dashboard() {
  const { profile, isAdmin, isSupervisor, user } = useAuth();
  const [counts, setCounts] = useState({ myEvals: 0, myPlans: 0, teamPending: 0, jobTitles: 0 });
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [creds, setCreds] = useState<DemoCred[]>([]);
  const seed = useServerFn(seedDemoData);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: myEvals }, { count: myPlans }, { count: jobTitles }] = await Promise.all([
        supabase.from("evaluations").select("id", { count: "exact", head: true }).eq("employee_id", user.id),
        supabase.from("development_plans").select("id", { count: "exact", head: true }).eq("employee_id", user.id),
        supabase.from("job_titles").select("id", { count: "exact", head: true }),
      ]);
      let teamPending = 0;
      if (isSupervisor) {
        const { data: reports } = await supabase.from("profiles").select("id").eq("supervisor_id", user.id);
        for (const r of reports ?? []) {
          const { data: last } = await supabase
            .from("evaluations")
            .select("overall_percent,evaluator_type,created_at")
            .eq("employee_id", r.id)
            .order("created_at", { ascending: false })
            .limit(2);
          const lastSelf = last?.find((l) => l.evaluator_type === "self");
          const hasSupAfter = last?.find(
            (l) => l.evaluator_type === "supervisor" && lastSelf && l.created_at > lastSelf.created_at,
          );
          if (lastSelf && Number(lastSelf.overall_percent) < 60 && !hasSupAfter) teamPending++;
        }
      }
      setCounts({ myEvals: myEvals ?? 0, myPlans: myPlans ?? 0, teamPending, jobTitles: jobTitles ?? 0 });

      // detect if demo data already exists
      const { data: marker } = await supabase
        .from("job_titles")
        .select("id")
        .eq("name", "Software Engineer (demo)")
        .maybeSingle();
      if (marker) setSeeded(true);
    })();
  }, [user, isSupervisor]);

  const onSeed = async () => {
    setSeeding(true);
    try {
      const res = await seed({ data: {} });
      if (res.alreadySeeded) {
        toast.info("Demo data already exists.");
      } else {
        toast.success("Demo data created. Use the credentials below to sign in as supervisor or employee.");
        setCreds(res.credentials);
      }
      setSeeded(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  const Tile = ({ icon: Icon, label, value, to }: any) => (
    <Link to={to}>
      <Card className="hover:border-accent transition">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div>
      <PageHeader title={`Welcome, ${profile?.full_name ?? ""}`} subtitle="Here's what's happening today." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={ClipboardCheck} label="My Evaluations" value={counts.myEvals} to="/evaluations" />
        <Tile icon={Sprout} label="My Development Plans" value={counts.myPlans} to="/development-plans" />
        {isSupervisor && <Tile icon={UserCheck} label="Team Awaiting Review" value={counts.teamPending} to="/supervisor" />}
        {isAdmin && <Tile icon={Briefcase} label="Job Titles" value={counts.jobTitles} to="/admin/job-titles" />}
      </div>

      {isAdmin && (
        <Card className="mt-6 border-accent/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" /> Seed demo data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates 3 demo job titles with competencies and 2 demo employees (one supervises the other),
              so you can explore self-evaluation, supervisor review, and development plans end-to-end.
            </p>
            <Button
              onClick={onSeed}
              disabled={seeding || seeded}
              className="bg-accent text-accent-foreground hover:opacity-90"
            >
              {seeding ? "Seeding…" : seeded ? "Already seeded" : "Seed demo data"}
            </Button>
            {creds.length > 0 && (
              <div className="mt-3 rounded-md border border-border p-3 bg-muted/40">
                <div className="text-xs font-medium mb-2">Demo accounts (sign out and sign in as these to test):</div>
                <ul className="text-sm space-y-1">
                  {creds.map((c) => (
                    <li key={c.email} className="font-mono">
                      {c.email} / {c.password} <span className="text-muted-foreground font-sans">— {c.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Admin defines job titles and the competencies for each.</p>
            <p>2. Employees with a job title self-evaluate on a 1–5 scale.</p>
            <p>3. If your overall score is below 60%, your supervisor reviews and may create a development plan.</p>
            <p>4. Track your development plan progress here.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Your role</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p><span className="font-medium">Job title:</span> {profile?.job_title_id ? "Assigned" : <span className="text-warning-foreground">Not assigned yet</span>}</p>
            <p className="mt-1"><span className="font-medium">Access:</span> {isAdmin ? "Admin" : "Employee"}{isSupervisor && " · Supervisor"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
