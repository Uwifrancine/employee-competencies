import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

type QuestionType = "multipleChoice" | "checkbox" | "select";

interface Choice { id: string; text: string }
interface Question { id: string; prompt: string; orderIndex: number; questionType: QuestionType; choices: Choice[] }
interface AssignmentDetail {
  id: string; status: string;
  quiz: { id: string; title: string; description?: string; questions: Question[] };
}

interface QuizModalProps {
  assignmentId: string;
  onComplete: () => void;
}

export function QuizModal({ assignmentId, onComplete }: QuizModalProps) {
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; correct: number; total: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AssignmentDetail>(`/api/quiz-assignments/${assignmentId}`)
      .then(setDetail)
      .catch((err) => {
        setError(err?.message || "Failed to load quiz");
        toast.error("Failed to load quiz");
      });
  }, [assignmentId]);

  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!detail) return <div className="text-center text-muted-foreground">Loading quiz...</div>;

  if (!detail.quiz?.questions || detail.quiz.questions.length === 0) {
    return <div className="text-center text-muted-foreground">No questions found</div>;
  }

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

  const questions = [...detail.quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  if (result) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="size-12 text-green-600 mx-auto" />
        <div>
          <div className="text-3xl font-bold text-green-600">{Math.round(result.scorePct)}%</div>
          <div className="text-sm text-muted-foreground mt-2">{result.correct} / {result.total} correct</div>
        </div>
        <Button onClick={onComplete} className="w-full bg-accent text-accent-foreground">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {currentStep + 1} of {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="font-medium">{currentQuestion.prompt}</div>

          {currentQuestion.questionType === "select" ? (
            <Select
              value={answers[currentQuestion.id]?.[0] ?? ""}
              onValueChange={(v) => selectOne(currentQuestion.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an answer…" />
              </SelectTrigger>
              <SelectContent>
                {currentQuestion.choices.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.text}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              {currentQuestion.choices.map((c) => {
                const selected =
                  currentQuestion.questionType === "checkbox"
                    ? (answers[currentQuestion.id] ?? []).includes(c.id)
                    : answers[currentQuestion.id]?.[0] === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
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
                    />
                    <span className="text-sm">{c.text}</span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex-1"
        >
          <ChevronLeft className="size-4 mr-1" /> Previous
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
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
