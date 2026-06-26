import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports/org")({
  ssr: false,
  component: OrgReport,
});

function OrgReport() {
  const [stats, setStats] = useState({
    employees: 0, jobTitles: 0, competencies: 0,
    evalsTotal: 0, evalsBelow60: 0, plansOpen: 0, quizzesAssigned: 0, quizzesCompleted: 0,
    avgSelf: 0, avgSup: 0,
  });
  const [byJob, setByJob] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: employees }, { count: jobTitles }, { count: competencies },
        { data: evals }, { count: plansOpen },
        { count: quizzesAssigned }, { count: quizzesCompleted },
        { data: jts }] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("job_titles").select("id", { count: "exact", head: true }),
          supabase.from("competencies").select("id", { count: "exact", head: true }),
          supabase.from("evaluations").select("evaluator_type,overall_percent"),
          supabase.from("development_plans").select("id", { count: "exact", head: true }).neq("status", "completed"),
          supabase.from("quiz_assignments").select("id", { count: "exact", head: true }),
          supabase.from("quiz_assignments").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("job_titles").select("id,name"),
        ]);
      const selfs = (evals ?? []).filter((e: any) => e.evaluator_type === "self").map((e: any) => Number(e.overall_percent));
      const sups = (evals ?? []).filter((e: any) => e.evaluator_type === "supervisor").map((e: any) => Number(e.overall_percent));
      const below = (evals ?? []).filter((e: any) => Number(e.overall_percent) < 60).length;

      setStats({
        employees: employees ?? 0, jobTitles: jobTitles ?? 0, competencies: competencies ?? 0,
        evalsTotal: (evals ?? []).length, evalsBelow60: below,
        plansOpen: plansOpen ?? 0,
        quizzesAssigned: quizzesAssigned ?? 0, quizzesCompleted: quizzesCompleted ?? 0,
        avgSelf: selfs.length ? selfs.reduce((a, b) => a + b, 0) / selfs.length : 0,
        avgSup: sups.length ? sups.reduce((a, b) => a + b, 0) / sups.length : 0,
      });

      const dist: { name: string; count: number }[] = [];
      for (const j of (jts ?? []) as any[]) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("job_title_id", j.id);
        dist.push({ name: j.name, count: count ?? 0 });
      }
      setByJob(dist);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Org Report" subtitle="Organization-wide performance snapshot." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Employees" value={stats.employees} />
        <Tile label="Job titles" value={stats.jobTitles} />
        <Tile label="Competencies" value={stats.competencies} />
        <Tile label="Open dev plans" value={stats.plansOpen} tone="warn" />
        <Tile label="Evaluations" value={stats.evalsTotal} />
        <Tile label="Evals below 60%" value={stats.evalsBelow60} tone="danger" />
        <Tile label="Quizzes assigned" value={stats.quizzesAssigned} />
        <Tile label="Quizzes completed" value={stats.quizzesCompleted} tone="ok" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader><CardTitle>Average scores</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Avg self-evaluation" value={stats.avgSelf} />
            <Row label="Avg supervisor evaluation" value={stats.avgSup} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Headcount by job title</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byJob.length === 0 && <div className="text-muted-foreground">No job titles.</div>}
            {byJob.map((b) => (
              <div key={b.name} className="flex justify-between border-b border-border last:border-0 py-2">
                <div>{b.name}</div><div className="font-semibold">{b.count}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-border last:border-0 py-2">
      <div>{label}</div>
      <div className={`font-semibold ${value === 0 ? "text-muted-foreground" : value >= 60 ? "text-success" : "text-destructive"}`}>
        {value === 0 ? "—" : `${value.toFixed(0)}%`}
      </div>
    </div>
  );
}
