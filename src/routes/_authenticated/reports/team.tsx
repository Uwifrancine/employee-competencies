import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports/team")({
  ssr: false,
  component: TeamReport,
});

interface Row {
  id: string; full_name: string;
  lastSelf?: number; lastSup?: number; plans: number; quizzes: number; quizAvg?: number;
}

function TeamReport() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: reports } = await supabase
        .from("profiles").select("id,full_name").eq("supervisor_id", user.id).order("full_name");
      const list: Row[] = [];
      for (const r of (reports ?? []) as any[]) {
        const [{ data: evals }, { data: plans }, { data: attempts }] = await Promise.all([
          supabase.from("evaluations").select("evaluator_type,overall_percent,created_at").eq("employee_id", r.id).order("created_at", { ascending: false }),
          supabase.from("development_plans").select("id").eq("employee_id", r.id),
          supabase.from("quiz_attempts").select("score_pct").eq("employee_id", r.id),
        ]);
        const lastSelf = (evals ?? []).find((e: any) => e.evaluator_type === "self");
        const lastSup = (evals ?? []).find((e: any) => e.evaluator_type === "supervisor");
        const quizAvg = (attempts ?? []).length ? (attempts as any[]).reduce((a, b) => a + Number(b.score_pct), 0) / (attempts as any[]).length : undefined;
        list.push({
          id: r.id, full_name: r.full_name,
          lastSelf: lastSelf ? Number(lastSelf.overall_percent) : undefined,
          lastSup: lastSup ? Number(lastSup.overall_percent) : undefined,
          plans: (plans ?? []).length,
          quizzes: (attempts ?? []).length,
          quizAvg,
        });
      }
      setRows(list);
    })();
  }, [user]);

  const cell = (v?: number) =>
    v === undefined ? <span className="text-muted-foreground">—</span> :
      <span className={`font-semibold ${v >= 60 ? "text-success" : "text-destructive"}`}>{v.toFixed(0)}%</span>;

  return (
    <div>
      <PageHeader title="Team Report" subtitle="Snapshot of every direct report." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Last self-eval</TableHead><TableHead>Last supervisor eval</TableHead>
            <TableHead>Dev plans</TableHead><TableHead>Quizzes</TableHead><TableHead>Quiz avg</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{cell(r.lastSelf)}</TableCell>
                <TableCell>{cell(r.lastSup)}</TableCell>
                <TableCell>{r.plans}</TableCell>
                <TableCell>{r.quizzes}</TableCell>
                <TableCell>{cell(r.quizAvg)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No direct reports.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
