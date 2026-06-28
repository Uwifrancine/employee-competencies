import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Competency { id: string; name: string; jobTitle: { id: string; name: string } }
interface Choice { text: string; isCorrect: boolean }
interface Question { prompt: string; questionType: "multipleChoice" | "checkbox" | "select"; choices: Choice[] }

interface QuizCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuizCreationDialog({ open, onOpenChange, onSuccess }: QuizCreationDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [competencyId, setCompetencyId] = useState<string>("");
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [questions, setQuestions] = useState<Question[]>([{ prompt: "", questionType: "multipleChoice", choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get<Competency[]>("/api/competencies").then(setCompetencies).catch(() => {});
  }, [open]);

  const updateQ = (qi: number, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  const changeType = (qi: number, type: "multipleChoice" | "checkbox" | "select") => {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        const choices = type === "checkbox" ? q.choices : q.choices.map((c, ci) => ({ ...c, isCorrect: ci === 0 }));
        return { ...q, questionType: type, choices };
      })
    );
  };

  const addQ = () => setQuestions((qs) => [...qs, { prompt: "", questionType: "multipleChoice", choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));

  const addC = (qi: number) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, choices: [...q.choices, { text: "", isCorrect: false }] } : q)));
  const rmC = (qi: number, ci: number) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, choices: q.choices.filter((_, x) => x !== ci) } : q)));

  const setChoiceText = (qi: number, ci: number, text: string) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.map((c, x) => (x === ci ? { ...c, text } : c)) } : q
      )
    );

  const toggleCorrect = (qi: number, ci: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        if (q.questionType === "checkbox") {
          return { ...q, choices: q.choices.map((c, x) => (x === ci ? { ...c, isCorrect: !c.isCorrect } : c)) };
        }
        return { ...q, choices: q.choices.map((c, x) => ({ ...c, isCorrect: x === ci })) };
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
          choices: q.choices.map((c, ci) => ({ text: c.text.trim(), isCorrect: c.isCorrect, orderIndex: ci })),
        });
      }

      toast.success("Quiz created successfully!");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setCompetencyId("");
      setQuestions([{ prompt: "", questionType: "multipleChoice", choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Quiz</DialogTitle>
          <DialogDescription>
            Build a quiz with multiple choice, checkbox, or select questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quiz Metadata */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Python Basics" />
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
                        {c.name} — {c.jobTitle.name}
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
          <div className="space-y-3">
            {questions.map((q, qi) => (
              <Card key={qi}>
                <CardContent className="p-5 space-y-3">
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

                  <Select value={q.questionType} onValueChange={(type: any) => changeType(qi, type)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multipleChoice">Multiple choice (one answer)</SelectItem>
                      <SelectItem value="checkbox">Checkboxes (multiple answers)</SelectItem>
                      <SelectItem value="select">Select / dropdown (one answer)</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-2">
                    {q.choices.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={c.isCorrect}
                          onChange={() => toggleCorrect(qi, ci)}
                          className="size-4"
                        />
                        <Input
                          value={c.text}
                          placeholder={`Choice ${ci + 1}`}
                          onChange={(e) => setChoiceText(qi, ci, e.target.value)}
                          className="flex-1"
                        />
                        {q.choices.length > 2 && (
                          <Button size="sm" variant="ghost" onClick={() => rmC(qi, ci)} className="text-destructive h-7">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button size="sm" variant="outline" onClick={() => addC(qi)} className="w-full">
                    <Plus className="size-4 mr-1" /> Add choice
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Question Button */}
          <Button onClick={addQ} variant="outline" className="w-full">
            <Plus className="size-4 mr-1" /> Add Question
          </Button>

          {/* Save Button */}
          <Button onClick={save} disabled={saving} className="w-full bg-accent text-accent-foreground">
            {saving ? "Creating…" : "Create Quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
