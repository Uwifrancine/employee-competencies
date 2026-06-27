import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports/org")({
  ssr: false,
  component: OrgReport,
});

function OrgReport() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get<any>("/api/reports/org").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const plans = data.developmentPlansByStatus ?? {};

  return (
    <div>
      <PageHeader title="Org Report" subtitle="Organization-wide performance snapshot." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Employees" value={data.totalEmployees ?? 0} />
        <Tile label="Evaluations" value={data.totalEvaluations ?? 0} />
        <Tile label="Open dev plans" value={(plans.open ?? 0) + (plans.in_progress ?? 0)} tone="warn" />
        <Tile label="Quizzes taken" value={data.quizAttempts ?? 0} />
        <Tile label="Avg eval score" value={data.averageScore ?? 0} pct />
        <Tile label="Avg quiz score" value={data.averageQuizScore ?? 0} pct />
        <Tile label="Completed plans" value={plans.completed ?? 0} tone="ok" />
      </div>

      {(data.topCompetencies ?? []).length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader><CardTitle>Top competencies by score</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {data.topCompetencies.map((c: any) => (
                <div key={c.competencyId} className="flex justify-between border-b border-border last:border-0 py-2">
                  <div>{c.name}</div>
                  <div className={`font-semibold ${c.avgScore >= 60 ? "text-success" : "text-destructive"}`}>
                    {c.avgScore?.toFixed(0) ?? "—"}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone, pct }: { label: string; value: number; tone?: "ok" | "warn"; pct?: boolean }) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : "";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color}`}>
          {value === 0 ? "—" : pct ? `${value.toFixed(0)}%` : value}
        </div>
      </CardContent>
    </Card>
  );
}
