import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
  id: string; fullName: string; email: string;
  jobTitle: { id: string; name: string } | null;
  latestEvalScore: number | null;
  latestEvalDate: string | null;
  openDevPlans: number;
  avgQuizScore: number | null;
}

function SupervisorPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ members: Report[] }>(`/api/reports/team/${user.id}`)
      .then((res) => setReports(res.members))
      .catch(() => {});
  }, [user?.id]);

  const stateFor = (r: Report) => {
    if (r.latestEvalScore === null) return { label: "not yet evaluated", tone: "pending" };
    if (r.latestEvalScore < 60) return { label: "needs improvement", tone: "fail" };
    return { label: "on track", tone: "pass" };
  };

  return (
    <div>
      <PageHeader title="My Team" subtitle="Employees who report to you." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Latest score</TableHead><TableHead>Open plans</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {reports.map((r) => {
              const s = stateFor(r);
              const belowTarget = r.latestEvalScore !== null && r.latestEvalScore < 60;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.fullName}<div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                  <TableCell>{r.latestEvalScore !== null ? `${r.latestEvalScore.toFixed(1)}%` : "—"}</TableCell>
                  <TableCell>{r.openDevPlans}</TableCell>
                  <TableCell><StatusBadge status={s.tone} /></TableCell>
                  <TableCell className="space-x-1">
                    <Link to="/supervisor/employee/$employeeId" params={{ employeeId: r.id }}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                    <Link to="/supervisor/evaluate/$employeeId" params={{ employeeId: r.id }}>
                      <Button size="sm" className="bg-accent text-accent-foreground">Evaluate</Button>
                    </Link>
                    {belowTarget && r.openDevPlans === 0 && (
                      <Link to="/supervisor/plan/new/$employeeId" params={{ employeeId: r.id }}>
                        <Button size="sm" variant="outline">Create plan</Button>
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
