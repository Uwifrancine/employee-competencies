import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/evaluate/$employeeId")({
  ssr: false,
  component: SupervisorEval,
});

interface Emp { id: string; fullName: string; jobTitle: { id: string; name: string } | null }
interface SelfScore {
  id: string;
  score: number;
  comment: string | null;
  competency: { id: string; name: string };
}
interface SelfEval { id: string; overallPercent: number; createdAt: string; scores: SelfScore[] }
interface QuizAttempt { id: string; scorePct: number; quiz: { title: string } }

function SupervisorEval() {
  const { employeeId } = Route.useParams();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [selfEval, setSelfEval] = useState<SelfEval | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [alreadyEvaluated, setAlreadyEvaluated] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<"pass" | "fail" | null>(null);

  useEffect(() => {
    (async () => {
      const [e, allEvals, assignments] = await Promise.all([
        api.get<Emp>(`/api/employees/${employeeId}`),
        api.get<any[]>("/api/evaluations"),
        api.get<any[]>("/api/quiz-assignments").catch(() => []),
      ]);
      setEmp(e);

      // Find employee's self-eval
      const selfEvals = allEvals
        .filter((x) => x.employee?.id === employeeId && x.evaluatorType === "self")
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (selfEvals[0]) {
        const full = await api.get<SelfEval>(`/api/evaluations/${selfEvals[0].id}`);
        setSelfEval(full);
      }

      // Check if supervisor already submitted a decision for this employee
      const supEvals = allEvals.filter(
        (x) => x.employee?.id === employeeId && x.evaluatorType === "supervisor"
      );
      if (supEvals.length > 0) setAlreadyEvaluated(true);

      // Quiz attempts for this employee
      const empAssignments = assignments.filter((a: any) => a.employee?.id === employeeId);
      const attempts: QuizAttempt[] = empAssignments
        .filter((a: any) => a.attempts?.length > 0)
        .map((a: any) => ({
          id: a.attempts[0].id ?? a.id,
          scorePct: a.attempts[0].scorePct,
          quiz: a.quiz,
        }));
      setQuizAttempts(attempts);
    })();
  }, [employeeId]);

  const decide = async (decision: "pass" | "fail") => {
    if (!emp?.jobTitle) return toast.error("Employee has no job title");
    setSaving(decision);
    try {
      await api.post("/api/evaluations", {
        employeeId: emp.id,
        jobTitleId: emp.jobTitle.id,
        evaluatorType: "supervisor",
        decision,
        notes: notes.trim() || undefined,
      });
      toast.success(decision === "pass" ? "Employee approved" : "Development need flagged");
      window.location.href = `/supervisor/employee/${employeeId}`;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(null);
    }
  };

  if (!emp) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/supervisor/employee/$employeeId" params={{ employeeId }}>
          <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        </Link>
      </div>

      <PageHeader
        title={`Review: ${emp.fullName}`}
        subtitle={emp.jobTitle?.name ?? "No job title"}
      />

      {/* Self-eval reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Self-evaluation scores (reference)</CardTitle>
        </CardHeader>
        <CardContent>
          {selfEval ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Submitted {new Date(selfEval.createdAt).toLocaleDateString()} ·{" "}
                Average: <span className="font-semibold text-foreground">{Number(selfEval.overallPercent).toFixed(0)}%</span>
              </div>
              <div className="divide-y divide-border">
                {selfEval.scores.map((s) => {
                  const stars = Math.round(s.score / 20);
                  return (
                    <div key={s.id} className="py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.competency.name}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <div key={v} className={`w-6 h-6 rounded text-xs grid place-items-center font-medium ${
                              v <= stars ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                            }`}>{v}</div>
                          ))}
                        </div>
                      </div>
                      {s.comment && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{s.comment}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {emp.fullName} has not submitted a self-evaluation yet. You can still record a decision.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quiz results */}
      {quizAttempts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quiz results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quizAttempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{a.quiz?.title}</span>
                <span className="font-semibold">{a.scorePct.toFixed(0)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decision */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {alreadyEvaluated && (
            <div className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              You have already submitted a decision for this employee. Submitting again will add another record.
            </div>
          )}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add feedback or development notes…"
              className="resize-none h-24 mt-1"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => decide("pass")}
              disabled={!!saving}
              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
            >
              <CheckCircle className="size-4 mr-2" />
              {saving === "pass" ? "Saving…" : "Approve (Pass)"}
            </Button>
            <Button
              onClick={() => decide("fail")}
              disabled={!!saving}
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <AlertTriangle className="size-4 mr-2" />
              {saving === "fail" ? "Saving…" : "Needs Development (Fail)"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
