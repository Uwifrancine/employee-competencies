import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes/new")({
  ssr: false,
  component: NewQuiz,
  validateSearch: (search: Record<string, unknown>) => ({
    employeeId: search.employeeId as string | undefined,
  }),
});

type QuestionType = "multipleChoice" | "checkbox" | "select";
interface Choice { text: string; isCorrect: boolean }
interface Question { prompt: string; questionType: QuestionType; choices: Choice[] }
interface Competency { id: string; name: string; jobTitle: { id: string; name: string } }

const TYPE_LABELS: Record<QuestionType, string> = {
  multipleChoice: "Multiple choice (one answer)",
  checkbox: "Checkboxes (multiple answers)",
  select: "Select / dropdown (one answer)",
};

function makeEmptyQuestion(): Question {
  return {
    prompt: "",
    questionType: "multipleChoice",
    choices: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

function NewQuiz() {
  const { employeeId } = useSearch({ from: "/_authenticated/supervisor/quizzes/new" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [competencyId, setCompetencyId] = useState<string>("");
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [questions, setQuestions] = useState<Question[]>([makeEmptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; fullName: string } | null>(null);

  useEffect(() => {
    api
      .get<Competency[]>("/api/competencies")
      .then(setCompetencies)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    api
      .get<any>(`/api/employees/${employeeId}`)
      .then((emp) => setSelectedEmployee({ id: emp.id, fullName: emp.fullName }))
      .catch(() => toast.error("Failed to load employee"));
  }, [employeeId]);

  const updateQ = (qi: number, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  const changeType = (qi: number, type: QuestionType) => {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        const choices =
          type === "checkbox"
            ? q.choices
            : q.choices.map((c, ci) => ({ ...c, isCorrect: ci === 0 }));
        return { ...q, questionType: type, choices };
      })
    );
  };

  const addQ = () => setQuestions((qs) => [...qs, makeEmptyQuestion()]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));

  const addC = (qi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, choices: [...q.choices, { text: "", isCorrect: false }] } : q
      )
    );
  const rmC = (qi: number, ci: number) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.filter((_, x) => x !== ci) } : q
      )
    );

  const setChoiceText = (qi: number, ci: number, text: string) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi
          ? { ...q, choices: q.choices.map((c, x) => (x === ci ? { ...c, text } : c)) }
          : q
      )
    );

  const toggleCorrect = (qi: number, ci: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        if (q.questionType === "checkbox") {
          return {
            ...q,
            choices: q.choices.map((c, x) => (x === ci ? { ...c, isCorrect: !c.isCorrect } : c)),
          };
        }
        return {
          ...q,
          choices: q.choices.map((c, x) => ({ ...c, isCorrect: x === ci })),
        };
      })
    );

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    for (const q of questions) {
      if (!q.prompt.trim()) return toast.error("Every question needs a prompt");
      if (q.choices.length < 2) return toast.error("Every question needs at least 2 choices");
      if (q.choices.some((c) => !c.text.trim())) return toast.error("Choice text cannot be empty");
      if (!q.choices.some((c) => c.isCorrect)) return toast.error("Mark at least one correct answer per question");
    }
    setSaving(true);
    try {
      const quiz = await api.post<{ id: string }>("/api/quizzes", {
        title: title.trim(),
        description: description.trim() || undefined,
        competencyId: competencyId || undefined,
      });

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        await api.post(`/api/quizzes/${quiz.id}/questions`, {
          prompt: q.prompt.trim(),
          orderIndex: qi,
          questionType: q.questionType,
          choices: q.choices.map((c, ci) => ({
            text: c.text.trim(),
            isCorrect: c.isCorrect,
            orderIndex: ci,
          })),
        });
      }

      if (employeeId) {
        await api.post("/api/quiz-assignments", {
          quizId: quiz.id,
          employeeId: employeeId,
        });
      }

      toast.success(employeeId ? `Quiz assigned to ${selectedEmployee?.fullName}` : "Quiz created");
      window.location.href = "/supervisor/quizzes";
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New quiz"
        subtitle={selectedEmployee ? `For ${selectedEmployee.fullName}` : "Build a quiz with multiple choice, checkbox, or select questions."}
      />
      <div className="space-y-4 max-w-3xl">
        {/* Quiz metadata */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Onboarding quiz" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this quiz about?" />
            </div>
            <div>
              <Label>Competency (optional)</Label>
              <Select value={competencyId} onValueChange={setCompetencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Link to a competency…" />
                </SelectTrigger>
                <SelectContent>
                  {competencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.jobTitle && (
                        <span className="text-muted-foreground ml-1 text-xs">— {c.jobTitle.name}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {competencyId && (
                <button
                  type="button"
                  onClick={() => setCompetencyId("")}
                  className="text-xs text-muted-foreground underline mt-1"
                >
                  Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        {questions.map((q, qi) => (
          <Card key={qi}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-muted-foreground">Question {qi + 1}</div>
                {questions.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => rmQ(qi)} className="text-destructive h-7">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <Input
                value={q.prompt}
                placeholder="Question prompt…"
                onChange={(e) => updateQ(qi, { prompt: e.target.value })}
              />

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Question type</Label>
                <Select value={q.questionType} onValueChange={(v) => changeType(qi, v as QuestionType)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {q.questionType === "checkbox" && (
                  <p className="text-xs text-muted-foreground mt-1">Check all choices that are correct — employees must select all of them.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground block">
                  Choices — {q.questionType === "checkbox" ? "tick all correct answers" : "select the one correct answer"}
                </Label>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type={q.questionType === "checkbox" ? "checkbox" : "radio"}
                      name={`correct-${qi}`}
                      checked={c.isCorrect}
                      onChange={() => toggleCorrect(qi, ci)}
                      className="accent-[color:var(--accent)] w-4 h-4 shrink-0"
                    />
                    <Input
                      value={c.text}
                      placeholder={`Choice ${ci + 1}`}
                      onChange={(e) => setChoiceText(qi, ci, e.target.value)}
                    />
                    {q.choices.length > 2 && (
                      <button type="button" onClick={() => rmC(qi, ci)} className="text-destructive p-1 shrink-0">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => addC(qi)}>
                  <Plus className="size-3 mr-1" /> Add choice
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-2">
          <Button variant="outline" onClick={addQ}>
            <Plus className="size-4 mr-1" /> Add question
          </Button>
          <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground">
            <Save className="size-4 mr-1" /> {saving ? "Saving…" : "Save quiz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
