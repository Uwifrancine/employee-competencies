import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports/individual")({
  ssr: false,
  component: IndividualReport,
});

function IndividualReport() {
  const { user, profile } = useAuth();
  const [evals, setEvals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: e }, { data: p }, { data: q }] = await Promise.all([
        supabase.from("evaluations").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
        supabase.from("development_plans").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
        supabase.from("quiz_attempts").select("score_pct,submitted_at,assignment_id,quiz_assignments(quizzes(title))").eq("employee_id", user.id),
      ]);
      setEvals(e ?? []); setPlans(p ?? []); setQuizzes(q ?? []);
    })();
  }, [user]);

  const avgSelf = avg(evals.filter((x) => x.evaluator_type === "self").map((x) => Number(x.overall_percent)));
  const avgSup = avg(evals.filter((x) => x.evaluator_type === "supervisor").map((x) => Number(x.overall_percent)));
  const avgQuiz = avg(quizzes.map((q) => Number(q.score_pct)));

  return (
    <div>
      <PageHeader title="My Report" subtitle={`Personal performance summary for ${profile?.full_name ?? ""}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Avg self-eval" value={avgSelf} />
        <Metric label="Avg supervisor eval" value={avgSup} />
        <Metric label="Avg quiz score" value={avgQuiz} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evaluations</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {evals.length === 0 && <div className="text-muted-foreground">No evaluations yet.</div>}
            {evals.map((e) => (
              <div key={e.id} className="flex justify-between border-b border-border last:border-0 py-2">
                <div>
                  <div className="font-medium capitalize">{e.evaluator_type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</div>
                </div>
                <div className={`font-semibold ${Number(e.overall_percent) >= 60 ? "text-success" : "text-destructive"}`}>
                  {Number(e.overall_percent).toFixed(0)}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Development plans</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {plans.length === 0 && <div className="text-muted-foreground">No plans.</div>}
            {plans.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-border last:border-0 py-2">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{p.status}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Quiz attempts</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {quizzes.length === 0 && <div className="text-muted-foreground">No attempts.</div>}
            {quizzes.map((q, i) => (
              <div key={i} className="flex justify-between border-b border-border last:border-0 py-2">
                <div className="font-medium">{q.quiz_assignments?.quizzes?.title ?? "Quiz"}</div>
                <div className={`font-semibold ${Number(q.score_pct) >= 60 ? "text-success" : "text-destructive"}`}>
                  {Number(q.score_pct).toFixed(0)}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${value === 0 ? "text-muted-foreground" : value >= 60 ? "text-success" : "text-destructive"}`}>
          {value === 0 ? "—" : `${value.toFixed(0)}%`}
        </div>
      </CardContent>
    </Card>
  );
}
