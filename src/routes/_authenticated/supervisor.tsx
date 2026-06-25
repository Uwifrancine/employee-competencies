import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/supervisor")({
  ssr: false,
  component: SupervisorPage,
});

interface Report {
  id: string; full_name: string; email: string; job_title_id: string | null;
  lastSelf?: { id: string; overall_percent: number; created_at: string } | null;
  lastSup?: { id: string; overall_percent: number; created_at: string } | null;
  hasPlan?: boolean;
}

function SupervisorPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rs } = await supabase.from("profiles")
        .select("id,full_name,email,job_title_id").eq("supervisor_id", user.id).order("full_name");
      const list = (rs ?? []) as Report[];
      for (const r of list) {
        const { data: evals } = await supabase.from("evaluations")
          .select("id,overall_percent,evaluator_type,created_at")
          .eq("employee_id", r.id).order("created_at", { ascending: false });
        r.lastSelf = (evals?.find((e) => e.evaluator_type === "self") as any) ?? null;
        r.lastSup = (evals?.find((e) => e.evaluator_type === "supervisor") as any) ?? null;
        const { count } = await supabase.from("development_plans")
          .select("id", { count: "exact", head: true }).eq("employee_id", r.id);
        r.hasPlan = (count ?? 0) > 0;
      }
      setReports([...list]);
    })();
  }, [user]);

  const stateFor = (r: Report) => {
    if (!r.lastSelf) return { label: "awaiting self-eval", tone: "pending" };
    const selfFail = Number(r.lastSelf.overall_percent) < 60;
    const supAfter = r.lastSup && r.lastSup.created_at > r.lastSelf.created_at;
    if (selfFail && !supAfter) return { label: "needs supervisor eval", tone: "pending" };
    if (selfFail && supAfter && Number(r.lastSup!.overall_percent) < 60 && !r.hasPlan) return { label: "needs dev plan", tone: "fail" };
    return { label: "on track", tone: "pass" };
  };

  return (
    <div>
      <PageHeader title="My Team" subtitle="Employees who report to you." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Last self</TableHead><TableHead>Last supervisor</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {reports.map((r) => {
              const s = stateFor(r);
              const selfFail = r.lastSelf && Number(r.lastSelf.overall_percent) < 60;
              const supAfter = r.lastSup && r.lastSelf && r.lastSup.created_at > r.lastSelf.created_at;
              const supFail = supAfter && Number(r.lastSup!.overall_percent) < 60;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}<div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                  <TableCell>{r.lastSelf ? `${Number(r.lastSelf.overall_percent).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell>{r.lastSup ? `${Number(r.lastSup.overall_percent).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell><StatusBadge status={s.tone} /></TableCell>
                  <TableCell className="space-x-2">
                    {selfFail && !supAfter && (
                      <Link to="/supervisor/evaluate/$employeeId" params={{ employeeId: r.id }}>
                        <Button size="sm" className="bg-accent text-accent-foreground">Evaluate</Button>
                      </Link>
                    )}
                    {supFail && !r.hasPlan && (
                      <Link to="/supervisor/plan/new/$employeeId" params={{ employeeId: r.id }}>
                        <Button size="sm" className="bg-accent text-accent-foreground">Create plan</Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {reports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No direct reports yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
