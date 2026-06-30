import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeEvaluationDialog } from "@/components/EmployeeEvaluationDialog";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor/")({
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
  supervisorEvaluated: boolean;
}

function SupervisorPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);

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
                  <TableCell className="space-x-1 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedEmployee({ id: r.id, name: r.fullName });
                        setEvalDialogOpen(true);
                      }}
                    >
                      <Eye className="size-3 mr-1" /> Evaluations
                    </Button>
                    {r.supervisorEvaluated ? (
                      <span className="inline-flex items-center rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium">
                        Evaluated
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-accent text-accent-foreground"
                        onClick={() => {
                          setSelectedEmployee({ id: r.id, name: r.fullName });
                          setEvaluateDialogOpen(true);
                        }}
                      >
                        Evaluate
                      </Button>
                    )}
                    {belowTarget && r.openDevPlans === 0 && (
                      <Link to="/supervisor/plan/new/$employeeId" params={{ employeeId: r.id }}>
                        <Button
                          size="sm"
                          variant="outline"
                        >
                          Create plan
                        </Button>
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

      <EmployeeEvaluationDialog
        employeeId={selectedEmployee?.id ?? null}
        employeeName={selectedEmployee?.name ?? ""}
        open={evalDialogOpen}
        onOpenChange={setEvalDialogOpen}
      />

      <EvaluateDialog
        employeeId={selectedEmployee?.id ?? null}
        employeeName={selectedEmployee?.name ?? ""}
        open={evaluateDialogOpen}
        onOpenChange={setEvaluateDialogOpen}
        onSuccess={() => {
          if (!user) return;
          api.get<{ members: Report[] }>(`/api/reports/team/${user.id}`)
            .then((res) => setReports(res.members))
            .catch(() => {});
          setEvaluateDialogOpen(false);
          setSelectedEmployee(null);
        }}
      />
    </div>
  );
}
