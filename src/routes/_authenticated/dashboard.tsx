import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Sprout, UserCheck, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const [counts, setCounts] = useState({ myEvals: 0, myPlans: 0, teamSize: 0, jobTitles: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get<any[]>("/api/evaluations").then((r) => r.length),
      api.get<any[]>("/api/development-plans").then((r) => r.length),
      api.get<{ teamSize: number }>(`/api/reports/team/${user.id}`).then((r) => r.teamSize).catch(() => 0),
      api.get<any[]>("/api/job-titles").then((r) => r.length).catch(() => 0),
    ]).then(([myEvals, myPlans, teamSize, jobTitles]) => {
      setCounts({ myEvals, myPlans, teamSize, jobTitles });
    });
  }, [user?.id]);

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
        {counts.teamSize > 0 && <Tile icon={UserCheck} label="Team Members" value={counts.teamSize} to="/supervisor" />}
        {isAdmin && <Tile icon={Briefcase} label="Job Titles" value={counts.jobTitles} to="/admin/job-titles" />}
      </div>

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
            <p className="mt-1"><span className="font-medium">Access:</span> {isAdmin ? "Admin" : "Employee"}{counts.teamSize > 0 && " · Supervisor"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
