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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id?: string;
  prompt: string;
  questionType: "multipleChoice" | "checkbox" | "select";
  choices: { id?: string; text: string; isCorrect: boolean; orderIndex?: number }[];
  orderIndex?: number;
}

interface Choice { text: string; isCorrect: boolean }

interface QuizEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  quizId: string;
  initialTitle: string;
  initialDescription: string | null;
}

export function QuizEditDialog({ open, onOpenChange, onSuccess, quizId, initialTitle, initialDescription }: QuizEditDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadQuiz();
  }, [open, quizId]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const quiz = await api.get<any>(`/api/quizzes/${quizId}`);
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setQuestions(quiz.questions || []);
    } catch (e: any) {
      toast.error("Failed to load quiz details");
    } finally {
      setLoading(false);
    }
  };

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
      await api.put(`/api/quizzes/${quizId}`, {
        title: title.trim(),
        description: description.trim() || undefined,
      });

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        if (!q.id) {
          await api.post(`/api/quizzes/${quizId}/questions`, {
            prompt: q.prompt.trim(),
            orderIndex: qi,
            questionType: q.questionType,
            choices: q.choices.map((c, ci) => ({ text: c.text.trim(), isCorrect: c.isCorrect, orderIndex: ci })),
          });
        } else {
          await api.put(`/api/quizzes/${quizId}/questions/${q.id}`, {
            prompt: q.prompt.trim(),
            orderIndex: qi,
            questionType: q.questionType,
          });
        }
      }

      toast.success("Quiz updated successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update quiz");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading quiz...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Quiz</DialogTitle>
          <DialogDescription>Update quiz details and questions</DialogDescription>
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
            {saving ? "Updating…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
