import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

interface Evaluation {
  id: string;
  evaluatorType: string;
  createdAt: string;
  overallPercent: number;
  scores: {
    id: string;
    score: number;
    competency: { id: string; name: string };
    comment?: string;
  }[];
}

interface QuizDetail {
  id: string;
  scorePct: number;
  quiz: { id: string; title: string; questions: any[] };
  answers: any[];
}

interface QuizAttempt {
  id: string;
  scorePct: number;
  quiz: { id: string; title: string; questions: any[] };
  answers: any[];
  submittedAt: string;
}

interface EmployeeEvaluationDialogProps {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeEvaluationDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: EmployeeEvaluationDialogProps) {
  const [evaluations, setEvaluations] = useState<(Evaluation & { quizScore?: number | null; quiz?: QuizDetail })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !employeeId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    Promise.all([
      api.get<any>(`/api/reports/individual/${employeeId}`),
      api.get<any[]>("/api/quiz-assignments"),
    ])
      .then(async ([evalRes, assignmentsRes]) => {
        const evals = evalRes.evaluations || [];
        console.log("Evaluations:", evals);

        // Get all quiz assignments with full details (including questions)
        const assignmentsWithAttempts = assignmentsRes.filter(
          (a: any) => a.employee?.id === employeeId && a.attempts?.length > 0
        );

        console.log("Assignments with attempts:", assignmentsWithAttempts);

        // Load full quiz details for each assignment
        const fullQuizAssignments = await Promise.all(
          assignmentsWithAttempts.map((a: any) =>
            api.get<any>(`/api/quiz-assignments/${a.id}`)
              .then((fullAssignment) => {
                console.log("Full assignment loaded:", fullAssignment);
                return fullAssignment;
              })
              .catch((err) => {
                console.error("Failed to load quiz assignment:", err);
                return null;
              })
          )
        );

        const quizAttempts = fullQuizAssignments
          .filter((a: any) => a !== null && a.attempts?.length > 0)
          .map((a: any) => ({
            id: a.attempts[0].id,
            scorePct: a.attempts[0].scorePct,
            quiz: a.quiz,
            answers: a.attempts[0].answers || [],
            submittedAt: a.attempts[0].submittedAt,
          }));

        console.log("Quiz Attempts with full details:", quizAttempts);

        // Match quizzes with evaluations
        // Show quiz only on self-evaluation (where it's taken) or latest evaluation
        const evalsWithQuiz = evals.map((e: Evaluation) => {
          let quiz = null;

          // Show quiz on self-evaluation if available
          if (e.evaluatorType === "self" && quizAttempts.length > 0) {
            // Show the quiz submitted closest to this self-evaluation
            quiz = quizAttempts.reduce((closest: any, q: any) => {
              const timeDiff = Math.abs(
                new Date(q.submittedAt).getTime() - new Date(e.createdAt).getTime()
              );
              const closestTimeDiff = closest
                ? Math.abs(new Date(closest.submittedAt).getTime() - new Date(e.createdAt).getTime())
                : Infinity;
              return timeDiff < closestTimeDiff ? q : closest;
            }, null);
          }

          console.log(`Evaluation ${e.id} (${e.evaluatorType}, ${e.createdAt}) -> Quiz:`, quiz);

          return {
            ...e,
            quizScore: quiz?.scorePct ?? null,
            quiz: quiz ? {
              id: quiz.id,
              scorePct: quiz.scorePct,
              quiz: {
                ...quiz.quiz,
                questions: quiz.quiz?.questions || [],
              },
              answers: quiz.answers,
            } : undefined,
          };
        });

        console.log("Evaluations with Quiz (final):", evalsWithQuiz);
        setEvaluations(evalsWithQuiz);
      })
      .catch((e) => {
        toast.error("Failed to load evaluations: " + e.message);
        setEvaluations([]);
      })
      .finally(() => setLoading(false));
  }, [open, employeeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>Evaluations - {employeeName}</DialogTitle>
          <DialogDescription>
            View all evaluations for this employee
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : evaluations.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground text-center py-8">
              No evaluations yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {evaluations.map((evaluation) => (
              <Card key={evaluation.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base capitalize">
                        {evaluation.evaluatorType} evaluation
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {evaluation.overallPercent.toFixed(0)}%
                        </div>
                        <div className={`text-xs font-semibold ${evaluation.overallPercent >= 60 ? "text-green-600" : "text-red-600"}`}>
                          {evaluation.overallPercent >= 60 ? "PASS" : "FAIL"}
                        </div>
                      </div>
                      {evaluation.quizScore !== null && evaluation.quizScore !== undefined && (
                        <div className="text-sm pt-1 border-t border-border">
                          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                            <GraduationCap className="size-3" /> Quiz
                          </div>
                          <div className={`text-lg font-semibold ${evaluation.quizScore >= 60 ? "text-success" : "text-destructive"}`}>
                            {evaluation.quizScore.toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Competencies Section */}
                  <div>
                    <div className="font-medium text-sm mb-3 text-muted-foreground">Competencies:</div>
                    <div className="space-y-3">
                      {evaluation.scores.map((score) => (
                        <div key={score.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">{score.competency.name}</div>
                            <div className="text-sm font-semibold text-accent">
                              {(score.score / 20).toFixed(0)}/5
                            </div>
                          </div>
                          {score.comment && (
                            <div className="text-sm text-muted-foreground italic">
                              "{score.comment}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quiz Section */}
                  {evaluation.quiz && (
                    <div className="border-t border-border pt-4">
                      <div className="font-medium text-sm mb-3 text-muted-foreground flex items-center gap-2">
                        <GraduationCap className="size-4" />
                        Quiz: {evaluation.quiz.quiz.title}
                      </div>
                      <div className="space-y-3">
                        {evaluation.quiz.quiz.questions?.map((q: any, idx: number) => {
                          const answers = evaluation.quiz!.answers.filter((a: any) => a.questionId === q.id);
                          const selectedChoices = answers.map((a: any) => {
                            const choice = q.choices.find((c: any) => c.id === a.choiceId);
                            return choice?.text || "No answer";
                          });

                          return (
                            <div key={q.id} className="bg-muted/40 rounded-lg p-3 border border-border">
                              <p className="text-sm font-medium mb-2">{idx + 1}. {q.prompt}</p>
                              <div className="text-sm space-y-1">
                                <p className="text-muted-foreground">
                                  <strong>Answer:</strong> {selectedChoices.length > 0 ? selectedChoices.join(", ") : "No answer"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <strong>Correct:</strong> {q.choices.filter((c: any) => c.isCorrect).map((c: any) => c.text).join(", ")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
