import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-quizzes/$assignmentId")({
  ssr: false,
  component: TakeQuiz,
});

interface Choice { id: string; text: string; is_correct: boolean }
interface Question { id: string; prompt: string; order_index: number; quiz_choices: Choice[] }

function TakeQuiz() {
  const { assignmentId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: a, error } = await supabase
        .from("quiz_assignments")
        .select("quiz_id,status,quizzes(title)")
        .eq("id", assignmentId)
        .maybeSingle();
      if (error || !a) { toast.error("Assignment not found"); return; }
      setQuizTitle((a as any).quizzes?.title ?? "Quiz");
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("id,prompt,order_index,quiz_choices(id,text,is_correct)")
        .eq("quiz_id", (a as any).quiz_id)
        .order("order_index");
      setQuestions(((qs ?? []) as any).map((q: any) => ({
        ...q,
        quiz_choices: (q.quiz_choices ?? []).sort((x: any, y: any) => x.id.localeCompare(y.id)),
      })));
      setLoaded(true);
    })();
  }, [assignmentId]);

  const submit = async () => {
    if (!user) return;
    if (Object.keys(answers).length !== questions.length) {
      return toast.error("Answer every question");
    }
    setSubmitting(true);
    try {
      let correct = 0;
      for (const q of questions) {
        const chosen = q.quiz_choices.find((c) => c.id === answers[q.id]);
        if (chosen?.is_correct) correct++;
      }
      const pct = (correct / questions.length) * 100;
      const { data: attempt, error: aErr } = await supabase
        .from("quiz_attempts")
        .insert({ assignment_id: assignmentId, employee_id: user.id, score_pct: pct })
        .select("id").single();
      if (aErr) throw aErr;
      const rows = questions.map((q) => ({
        attempt_id: attempt.id, question_id: q.id, choice_id: answers[q.id] ?? null,
      }));
      const { error: ansErr } = await supabase.from("quiz_answers").insert(rows);
      if (ansErr) throw ansErr;
      await supabase.from("quiz_assignments").update({ status: "completed" }).eq("id", assignmentId);
      toast.success(`Submitted — scored ${pct.toFixed(0)}%`);
      navigate({ to: "/my-quizzes" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setSubmitting(false); }
  };

  if (!loaded) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title={quizTitle} subtitle="Pick the best answer for each question." />
      <div className="space-y-4 max-w-3xl">
        {questions.map((q, i) => (
          <Card key={q.id}><CardContent className="p-5 space-y-3">
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            <div className="space-y-2">
              {q.quiz_choices.map((c) => (
                <label key={c.id} className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer ${answers[q.id] === c.id ? "bg-accent/10 border-accent" : ""}`}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === c.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                  />
                  <span className="text-sm">{c.text}</span>
                </label>
              ))}
            </div>
          </CardContent></Card>
        ))}
        <Button onClick={submit} disabled={submitting} className="bg-accent text-accent-foreground">
          {submitting ? "Submitting…" : "Submit answers"}
        </Button>
      </div>
    </div>
  );
}
