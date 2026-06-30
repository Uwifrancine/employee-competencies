import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, AlertTriangle, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

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
interface QuizAttempt {
  id: string;
  scorePct: number;
  quiz: { id: string; title: string; questions: any[] };
  answers: any[];
}

function SupervisorEval() {
  const { employeeId } = Route.useParams();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [selfEval, setSelfEval] = useState<SelfEval | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [alreadyEvaluated, setAlreadyEvaluated] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<"pass" | "fail" | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizAttempt | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);

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

      // Quiz attempts for this employee - load full details
      const empAssignments = assignments.filter((a: any) => a.employee?.id === employeeId);
      const attempts: QuizAttempt[] = empAssignments
        .filter((a: any) => a.attempts?.length > 0)
        .map((a: any) => ({
          id: a.attempts[0].id ?? a.id,
          scorePct: a.attempts[0].scorePct,
          quiz: a.quiz,
          answers: a.attempts[0].answers || [],
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

  const exportQuizToPdf = (quiz: QuizAttempt) => {
    if (!emp) return;

    const html = document.createElement("div");
    html.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="margin-bottom: 10px;">${quiz.quiz.title}</h1>
        <p style="color: #666; margin-bottom: 20px;">Employee: ${emp.fullName} | Score: ${Math.round(quiz.scorePct)}%</p>

        <div style="border-top: 2px solid #ccc; padding-top: 20px;">
          ${quiz.quiz.questions.map((q: any, idx: number) => `
            <div style="margin-bottom: 20px; page-break-inside: avoid;">
              <p style="font-weight: bold; margin-bottom: 10px;">${idx + 1}. ${q.prompt}</p>
              <div style="margin-left: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                <p style="margin: 5px 0;"><strong>Answer:</strong>
                  ${quiz.answers
                    .filter((a: any) => a.questionId === q.id)
                    .map((a: any) => {
                      const choice = q.choices.find((c: any) => c.id === a.choiceId);
                      return choice ? choice.text : "No answer";
                    })
                    .join(", ") || "No answer"}
                </p>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    html2pdf().set({ html2canvas: { scale: 2 }, margin: 10 }).from(html).save(`${emp.fullName}_quiz_${quiz.quiz.title}.pdf`);
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
          <CardContent className="space-y-3">
            {quizAttempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-accent transition">
                <div className="flex-1">
                  <div className="font-medium">{a.quiz?.title}</div>
                  <div className="text-sm text-muted-foreground">{Math.round(a.scorePct)}% · {a.quiz?.questions?.length || 0} questions</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedQuiz(a);
                      setShowQuizModal(true);
                    }}
                  >
                    <Eye className="size-4 mr-1" /> View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportQuizToPdf(a)}
                  >
                    <Download className="size-4 mr-1" /> PDF
                  </Button>
                </div>
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
          {alreadyEvaluated ? (
            <div className="flex items-start gap-2 text-sm text-success bg-success/10 rounded-md px-3 py-3">
              <CheckCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                You have already submitted a supervisor evaluation for {emp.fullName}. An
                evaluation can only be recorded once per employee.
              </span>
            </div>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Quiz Details Modal */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          {selectedQuiz && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selectedQuiz.quiz.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-semibold text-lg text-accent">{Math.round(selectedQuiz.scorePct)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions:</span>
                  <span>{selectedQuiz.quiz.questions?.length || 0}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                {selectedQuiz.quiz.questions?.map((q: any, idx: number) => {
                  const answers = selectedQuiz.answers.filter((a: any) => a.questionId === q.id);
                  const selectedChoices = answers.map((a: any) => {
                    const choice = q.choices.find((c: any) => c.id === a.choiceId);
                    return choice?.text || "No answer";
                  });

                  return (
                    <div key={q.id} className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2">{idx + 1}. {q.prompt}</p>
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">
                          <strong>Answer:</strong> {selectedChoices.length > 0 ? selectedChoices.join(", ") : "No answer"}
                        </p>
                        {selectedChoices.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <strong>Correct:</strong> {q.choices.filter((c: any) => c.isCorrect).map((c: any) => c.text).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => exportQuizToPdf(selectedQuiz)}
                  className="flex-1 bg-accent text-accent-foreground"
                >
                  <Download className="size-4 mr-2" /> Export as PDF
                </Button>
                <Button onClick={() => setShowQuizModal(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
