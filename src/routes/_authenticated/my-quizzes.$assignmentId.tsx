import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-quizzes/$assignmentId")({
  ssr: false,
  component: TakeQuiz,
});

type QuestionType = "multipleChoice" | "checkbox" | "select";

interface Choice { id: string; text: string }
interface Question { id: string; prompt: string; orderIndex: number; questionType: QuestionType; choices: Choice[] }
interface AssignmentDetail {
  id: string; status: string;
  quiz: { id: string; title: string; description?: string; questions: Question[] };
}

function TakeQuiz() {
  const { assignmentId } = Route.useParams();
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; correct: number; total: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Loading quiz assignment:", assignmentId);
    api
      .get<AssignmentDetail>(`/api/quiz-assignments/${assignmentId}`)
      .then((data) => {
        console.log("Quiz loaded:", data);
        setDetail(data);
      })
      .catch((err) => {
        console.error("Failed to load quiz:", err);
        const errorMsg = err?.message || "Failed to load quiz";
        setError(errorMsg);
        toast.error(errorMsg);
      });
  }, [assignmentId]);

  // Prevent browser back button while taking quiz
  useEffect(() => {
    if (!result) {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        toast.error("You must complete the quiz before leaving");
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [result]);

  const selectOne = (qId: string, choiceId: string) =>
    setAnswers((a) => ({ ...a, [qId]: [choiceId] }));

  const toggleChoice = (qId: string, choiceId: string) =>
    setAnswers((a) => {
      const current = a[qId] ?? [];
      return {
        ...a,
        [qId]: current.includes(choiceId)
          ? current.filter((x) => x !== choiceId)
          : [...current, choiceId],
      };
    });

  const submit = async () => {
    if (!detail) return;
    const questions = detail.quiz.questions;
    const unanswered = questions.filter((q) => !(answers[q.id]?.length));
    if (unanswered.length) return toast.error("Answer every question before submitting");
    setSubmitting(true);
    try {
      const res = await api.post<{ scorePct: number; correct: number; total: number }>(
        `/api/quiz-assignments/${assignmentId}/attempt`,
        { answers: questions.map((q) => ({ questionId: q.id, choiceIds: answers[q.id] ?? [] })) }
      );
      setResult(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="grid place-items-center min-h-screen bg-gradient-to-b from-accent/5 to-background p-4">
        <Card className="max-w-md border-destructive">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-lg font-semibold text-destructive">Error Loading Quiz</div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.href = "/evaluations"} variant="outline">
              Back to Evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="grid place-items-center min-h-screen bg-gradient-to-b from-accent/5 to-background">
        <div className="space-y-4 text-center">
          <div className="text-lg font-medium text-muted-foreground">Loading quiz...</div>
          <Progress value={30} className="w-32" />
        </div>
      </div>
    );
  }

  if (!detail.quiz || !detail.quiz.questions || detail.quiz.questions.length === 0) {
    return (
      <div className="grid place-items-center min-h-screen bg-gradient-to-b from-accent/5 to-background p-4">
        <Card className="max-w-md border-warning">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-lg font-semibold">No Questions Found</div>
            <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>
            <Button onClick={() => window.location.href = "/evaluations"} variant="outline">
              Back to Evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = [...detail.quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  if (result) {
    return (
      <div className="grid place-items-center min-h-screen bg-gradient-to-b from-accent/5 to-background">
        <div className="text-center space-y-6">
          <CheckCircle2 className="size-16 text-green-600 mx-auto" />
          <div>
            <div className="text-6xl font-bold text-green-600">{Math.round(result.scorePct)}%</div>
            <div className="text-xl font-medium mt-2">{result.correct} / {result.total} correct</div>
          </div>
          <div className="text-lg font-medium text-foreground">{detail.quiz.title}</div>
          <div className="text-sm text-muted-foreground">Quiz completed successfully!</div>
          <Button
            onClick={() => (window.location.href = "/evaluations")}
            className="mt-4 bg-accent text-accent-foreground"
          >
            Back to Evaluations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center min-h-screen bg-gradient-to-b from-accent/5 to-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">{detail.quiz.title}</h1>
          {detail.quiz.description && (
            <p className="text-muted-foreground">{detail.quiz.description}</p>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Question {currentStep + 1} of {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Question Card */}
        <Card className="border-accent/30">
          <CardContent className="p-8 space-y-6">
            <div className="text-xl font-medium">{currentQuestion.prompt}</div>

            {currentQuestion.questionType === "checkbox" && (
              <p className="text-sm text-muted-foreground italic">Select all that apply</p>
            )}

            {currentQuestion.questionType === "select" ? (
              <Select
                value={answers[currentQuestion.id]?.[0] ?? ""}
                onValueChange={(v) => selectOne(currentQuestion.id, v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choose an answer…" />
                </SelectTrigger>
                <SelectContent>
                  {currentQuestion.choices.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.text}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3">
                {currentQuestion.choices.map((c) => {
                  const selected =
                    currentQuestion.questionType === "checkbox"
                      ? (answers[currentQuestion.id] ?? []).includes(c.id)
                      : answers[currentQuestion.id]?.[0] === c.id;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        selected ? "bg-accent/10 border-accent" : "border-border hover:border-accent/50"
                      }`}
                    >
                      <input
                        type={currentQuestion.questionType === "checkbox" ? "checkbox" : "radio"}
                        name={`q-${currentQuestion.id}`}
                        checked={selected}
                        onChange={() =>
                          currentQuestion.questionType === "checkbox"
                            ? toggleChoice(currentQuestion.id, c.id)
                            : selectOne(currentQuestion.id, c.id)
                        }
                        className="w-5 h-5 shrink-0"
                      />
                      <span className="text-base flex-1">{c.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="size-4 mr-2" /> Previous
          </Button>

          {currentStep === questions.length - 1 ? (
            <Button
              onClick={submit}
              disabled={submitting}
              className="flex-1 bg-accent text-accent-foreground"
            >
              {submitting ? "Submitting…" : "Submit Quiz"}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex-1 bg-accent text-accent-foreground"
            >
              Next <ChevronRight className="size-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
