import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports/individual")({
  ssr: false,
  component: IndividualReport,
});

function IndividualReport() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    api.get<any>(`/api/reports/individual/${user.id}`).then(setData).catch(() => {});
  }, [user?.id]);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const { evaluations = [], developmentPlans = [], quizAttempts = [], summary } = data;

  return (
    <div>
      <PageHeader title="My Report" subtitle={`Personal performance summary for ${profile?.full_name ?? ""}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Avg self-eval" value={summary?.averageScore ?? 0} />
        <Metric label="Dev plans" value={summary?.totalDevPlans ?? 0} raw />
        <Metric label="Avg quiz score" value={summary?.averageQuizScore ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evaluations</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {evaluations.length === 0 && <div className="text-muted-foreground">No evaluations yet.</div>}
            {evaluations.map((e: any) => (
              <div key={e.id} className="flex justify-between border-b border-border last:border-0 py-2">
                <div>
                  <div className="font-medium capitalize">{e.evaluatorType}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</div>
                </div>
                <div className={`font-semibold ${e.overallPercent >= 60 ? "text-success" : "text-destructive"}`}>
                  {Number(e.overallPercent).toFixed(0)}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Development plans</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {developmentPlans.length === 0 && <div className="text-muted-foreground">No plans.</div>}
            {developmentPlans.map((p: any) => (
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
            {quizAttempts.length === 0 && <div className="text-muted-foreground">No attempts.</div>}
            {quizAttempts.map((q: any) => (
              <div key={q.id} className="flex justify-between border-b border-border last:border-0 py-2">
                <div className="font-medium">{q.assignment?.quiz?.title ?? "Quiz"}</div>
                <div className={`font-semibold ${q.scorePct >= 60 ? "text-success" : "text-destructive"}`}>
                  {Number(q.scorePct).toFixed(0)}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, raw }: { label: string; value: number; raw?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${raw || value === 0 ? "text-muted-foreground" : value >= 60 ? "text-success" : "text-destructive"}`}>
          {value === 0 ? "—" : raw ? value : `${value.toFixed(0)}%`}
        </div>
      </CardContent>
    </Card>
  );
}
