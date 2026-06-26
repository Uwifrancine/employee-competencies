import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes/new")({
  ssr: false,
  component: NewQuiz,
});

interface Choice { text: string; is_correct: boolean }
interface Question { prompt: string; choices: Choice[] }

function NewQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { prompt: "", choices: [{ text: "", is_correct: true }, { text: "", is_correct: false }] },
  ]);
  const [saving, setSaving] = useState(false);

  const addQ = () => setQuestions((qs) => [...qs, { prompt: "", choices: [{ text: "", is_correct: true }, { text: "", is_correct: false }] }]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const addC = (qi: number) => setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, choices: [...q.choices, { text: "", is_correct: false }] } : q));
  const rmC = (qi: number, ci: number) => setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, choices: q.choices.filter((_, x) => x !== ci) } : q));
  const setCorrect = (qi: number, ci: number) => setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, choices: q.choices.map((c, x) => ({ ...c, is_correct: x === ci })) } : q));

  const save = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    for (const q of questions) {
      if (!q.prompt.trim()) return toast.error("Every question needs a prompt");
      if (q.choices.length < 2) return toast.error("Every question needs ≥ 2 choices");
      if (!q.choices.some((c) => c.is_correct)) return toast.error("Mark a correct answer on every question");
      if (q.choices.some((c) => !c.text.trim())) return toast.error("Choice text cannot be empty");
    }
    setSaving(true);
    try {
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({ supervisor_id: user.id, title: title.trim(), description: description.trim() || null })
        .select("id").single();
      if (error) throw error;

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        const { data: qRow, error: qErr } = await supabase
          .from("quiz_questions")
          .insert({ quiz_id: quiz.id, prompt: q.prompt.trim(), order_index: qi })
          .select("id").single();
        if (qErr) throw qErr;
        const { error: cErr } = await supabase.from("quiz_choices").insert(
          q.choices.map((c, ci) => ({ question_id: qRow.id, text: c.text.trim(), is_correct: c.is_correct, order_index: ci })),
        );
        if (cErr) throw cErr;
      }

      toast.success("Quiz created");
      navigate({ to: "/supervisor/quizzes" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="New quiz" subtitle="Create a simple multiple-choice quiz." />
      <div className="space-y-4 max-w-3xl">
        <Card><CardContent className="p-5 space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Onboarding quiz" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
        </CardContent></Card>

        {questions.map((q, qi) => (
          <Card key={qi}><CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Question {qi + 1}</div>
              {questions.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => rmQ(qi)} className="text-destructive"><Trash2 className="size-4" /></Button>
              )}
            </div>
            <Input
              value={q.prompt}
              placeholder="Question prompt"
              onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, prompt: e.target.value } : x))}
            />
            <div className="space-y-2">
              {q.choices.map((c, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={c.is_correct}
                    onChange={() => setCorrect(qi, ci)}
                    className="accent-[color:var(--accent)]"
                  />
                  <Input
                    value={c.text}
                    placeholder={`Choice ${ci + 1}`}
                    onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, choices: x.choices.map((cc, cx) => cx === ci ? { ...cc, text: e.target.value } : cc) } : x))}
                  />
                  {q.choices.length > 2 && (
                    <button onClick={() => rmC(qi, ci)} className="text-destructive p-1"><Trash2 className="size-4" /></button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addC(qi)}><Plus className="size-3 mr-1" /> Add choice</Button>
            </div>
          </CardContent></Card>
        ))}

        <div className="flex gap-2">
          <Button variant="outline" onClick={addQ}><Plus className="size-4 mr-1" /> Add question</Button>
          <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground">
            <Save className="size-4 mr-1" /> {saving ? "Saving…" : "Save quiz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
