import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor/employee/$employeeId")({
  ssr: false,
  component: EmployeeDetailPage,
});

interface Emp {
  id: string; fullName: string; email: string;
  jobTitle: { id: string; name: string } | null;
}
interface EvalScore {
  id: string; score: number; comment: string | null;
  competency: { id: string; name: string };
}
interface Eval {
  id: string; overallPercent: number; evaluatorType: string; createdAt: string;
  scores?: EvalScore[];
}
interface Assignment {
  id: string; status: string;
  quiz: { id: string; title: string };
  employee: { id: string; fullName: string };
  attempts: { scorePct: number; submittedAt: string }[];
}

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [selfEval, setSelfEval] = useState<Eval | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [e, allEvals, allAssignments] = await Promise.all([
        api.get<Emp>(`/api/employees/${employeeId}`),
        api.get<Eval[]>("/api/evaluations"),
        api.get<Assignment[]>("/api/quiz-assignments"),
      ]);
      setEmp(e);

      // Find the latest self-evaluation for this employee
      const selfEvals = allEvals
        .filter((ev) => (ev as any).employee?.id === employeeId && ev.evaluatorType === "self")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (selfEvals.length > 0) {
        const full = await api.get<Eval>(`/api/evaluations/${selfEvals[0].id}`);
        setSelfEval(full);
      }

      // Quiz assignments for this employee created by this supervisor
      const mine = allAssignments.filter(
        (a) => a.employee?.id === employeeId
      );
      setAssignments(mine);
    })();
  }, [employeeId, user?.id]);

  if (!emp) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/supervisor">
          <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Team</Button>
        </Link>
      </div>

      <PageHeader
        title={emp.fullName}
        subtitle={emp.jobTitle?.name ?? "No job title assigned"}
      />

      {/* Self-evaluation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-4" /> Self-evaluation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selfEval ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Submitted {new Date(selfEval.createdAt).toLocaleDateString()}</span>
                <span className="font-semibold text-foreground">
                  Overall: {Number(selfEval.overallPercent).toFixed(1)}%
                </span>
              </div>
              <div className="divide-y divide-border">
                {(selfEval.scores ?? []).map((s) => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.competency.name}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((v) => {
                          const filled = v <= Math.round(s.score / 20);
                          return (
                            <div
                              key={v}
                              className={`w-6 h-6 rounded text-xs grid place-items-center font-medium ${
                                filled
                                  ? "bg-accent text-accent-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {v}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {s.comment && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{s.comment}"</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  to="/supervisor/evaluate/$employeeId"
                  params={{ employeeId }}
                >
                  <Button size="sm" className="bg-accent text-accent-foreground">
                    Write supervisor evaluation
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {emp.fullName} has not submitted a self-evaluation yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quiz results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="size-4" /> Quiz results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quizzes assigned yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {assignments.map((a) => {
                const latestAttempt = a.attempts?.[0];
                return (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{a.quiz?.title}</div>
                      {latestAttempt && (
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(latestAttempt.submittedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {latestAttempt ? (
                        <span className="text-sm font-semibold text-primary">
                          {latestAttempt.scorePct.toFixed(0)}%
                        </span>
                      ) : null}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-3">
            <Link to="/supervisor/quizzes">
              <Button size="sm" variant="outline">
                <GraduationCap className="size-4 mr-1" /> Manage quizzes
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
