import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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

  useEffect(() => {
    api
      .get<AssignmentDetail>(`/api/quiz-assignments/${assignmentId}`)
      .then(setDetail)
      .catch(() => toast.error("Assignment not found"));
  }, [assignmentId]);

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

  if (!detail) return <div className="text-muted-foreground">Loading…</div>;

  const questions = [...detail.quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);

  if (result) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="text-6xl font-bold text-primary">{result.scorePct.toFixed(0)}%</div>
        <div className="text-lg font-medium">{result.correct} / {result.total} correct</div>
        <div className="text-sm text-muted-foreground">{detail.quiz.title} completed</div>
        <Button
          onClick={() => (window.location.href = "/my-quizzes")}
          className="mt-2 bg-accent text-accent-foreground"
        >
          Back to my quizzes
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={detail.quiz.title}
        subtitle={detail.quiz.description ?? "Pick the best answer(s) for each question."}
      />
      <div className="space-y-4 max-w-3xl">
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="p-5 space-y-3">
              <div className="font-medium">{i + 1}. {q.prompt}</div>
              {q.questionType === "checkbox" && (
                <p className="text-xs text-muted-foreground">Select all that apply</p>
              )}

              {q.questionType === "select" ? (
                <Select
                  value={answers[q.id]?.[0] ?? ""}
                  onValueChange={(v) => selectOne(q.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an answer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.choices.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  {q.choices.map((c) => {
                    const selected =
                      q.questionType === "checkbox"
                        ? (answers[q.id] ?? []).includes(c.id)
                        : answers[q.id]?.[0] === c.id;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                          selected ? "bg-accent/10 border-accent" : "border-border hover:border-accent/50"
                        }`}
                      >
                        <input
                          type={q.questionType === "checkbox" ? "checkbox" : "radio"}
                          name={`q-${q.id}`}
                          checked={selected}
                          onChange={() =>
                            q.questionType === "checkbox"
                              ? toggleChoice(q.id, c.id)
                              : selectOne(q.id, c.id)
                          }
                          className="accent-[color:var(--accent)] w-4 h-4 shrink-0"
                        />
                        <span className="text-sm">{c.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-accent text-accent-foreground"
        >
          {submitting ? "Submitting…" : "Submit answers"}
        </Button>
      </div>
    </div>
  );
}
