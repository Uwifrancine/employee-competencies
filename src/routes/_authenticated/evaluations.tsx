import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/evaluations")({
  ssr: false,
  component: EvaluationsPage,
});

interface Eval {
  id: string;
  overallPercent: number;
  evaluatorType: string;
  createdAt: string;
  employee?: { id: string; fullName: string };
  evaluator?: { id: string; fullName: string };
}

function evalStatus(r: Eval) {
  if (r.evaluatorType === "self") return "submitted";
  return r.overallPercent >= 60 ? "pass" : "fail";
}

function evalStatusLabel(r: Eval) {
  if (r.evaluatorType === "self") return "Submitted";
  return r.overallPercent >= 60 ? "Approved" : "Needs development";
}

function EvaluationsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile } = useAuth();
  const [rows, setRows] = useState<Eval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname !== "/evaluations") return;

    api
      .get<Eval[]>("/api/evaluations")
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

  if (pathname !== "/evaluations") return <Outlet />;

  const selfEvals = rows.filter((r) => r.evaluatorType === "self");
  const supervisorEvals = rows.filter((r) => r.evaluatorType === "supervisor");
  const hasSelfEval = selfEvals.length > 0;
  const latestSupervisorEval = supervisorEvals[0];

  return (
    <div>
      <PageHeader
        title="My Evaluations"
        subtitle="Your self-assessments and supervisor reviews."
        action={
          profile?.job_title_id && !hasSelfEval ? (
            <Link to="/evaluations/new">
              <Button className="bg-accent text-accent-foreground">
                <Plus className="size-4 mr-1" /> Start self-evaluation
              </Button>
            </Link>
          ) : null
        }
      />

      {loading ? null : !profile?.job_title_id ? (
        <Card className="mb-4 border-warning">
          <CardContent className="p-5 space-y-1">
            <div className="font-medium">No job title assigned</div>
            <p className="text-sm text-muted-foreground">
              Ask your HR or admin to assign a job title to your account so you can begin your
              self-evaluation.
            </p>
          </CardContent>
        </Card>
      ) : !hasSelfEval ? (
        <Card className="mb-6">
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 font-medium">
              <ClipboardCheck className="size-4 text-accent" />
              Self-evaluation pending
            </div>
            <p className="text-sm text-muted-foreground">
              Rate yourself 1–5 on each competency for your role. You can only submit this once.
              After submitting, your supervisor will review and make the final decision.
            </p>
            <Link to="/evaluations/new">
              <Button className="bg-accent text-accent-foreground">
                <Plus className="size-4 mr-1" /> Start self-evaluation
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Supervisor decision banner */}
          {latestSupervisorEval ? (
            <Card
              className={`mb-4 border-2 ${latestSupervisorEval.overallPercent >= 60 ? "border-success" : "border-destructive"}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {latestSupervisorEval.overallPercent >= 60
                      ? "Your supervisor has approved your evaluation"
                      : "Your supervisor has flagged a development need"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Reviewed on {new Date(latestSupervisorEval.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={latestSupervisorEval.overallPercent >= 60 ? "pass" : "fail"} />
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-4 bg-muted/40">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Self-evaluation submitted. Your supervisor will review and provide a decision.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.createdAt).toLocaleDateString("en-GB")}</TableCell>{" "}
                      <TableCell className="capitalize">
                        {r.evaluatorType === "self" ? "Self" : "Supervisor review"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.evaluatorType === "self"
                          ? `${Number(r.overallPercent).toFixed(0)}%`
                          : r.overallPercent >= 60
                            ? "Pass"
                            : "Fail"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={evalStatus(r)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
