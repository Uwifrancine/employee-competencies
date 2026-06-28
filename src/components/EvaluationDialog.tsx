import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Comp {
  id: string;
  name: string;
  description: string | null;
}

interface CompScore {
  score: number | null;
  comment: string;
}

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EvaluationDialog({
  open,
  onOpenChange,
  onSuccess,
}: EvaluationDialogProps) {
  const { profile } = useAuth();
  const [comps, setComps] = useState<Comp[]>([]);
  const [compsLoading, setCompsLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, CompScore>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !profile?.job_title_id) {
      setCompsLoading(false);
      return;
    }
    setCompsLoading(true);
    api
      .get<Comp[]>(`/api/competencies?jobTitleId=${profile.job_title_id}`)
      .then((cs) => {
        setComps(cs);
        setScores(Object.fromEntries(cs.map((c) => [c.id, { score: null, comment: "" }])));
      })
      .catch((e) => {
        toast.error("Failed to load competencies: " + e.message);
      })
      .finally(() => setCompsLoading(false));
  }, [open, profile?.job_title_id]);

  const setScore = (id: string, v: number) =>
    setScores((s) => ({ ...s, [id]: { comment: s[id]?.comment ?? "", score: v } }));

  const setComment = (id: string, v: string) =>
    setScores((s) => ({ ...s, [id]: { score: s[id]?.score ?? null, comment: v } }));

  const submit = async () => {
    if (!profile?.job_title_id || !profile?.id) {
      toast.error("Job title not assigned");
      return;
    }
    const unrated = comps.filter((c) => scores[c.id]?.score == null);
    if (unrated.length) return toast.error("Rate every competency before submitting");
    setSaving(true);
    try {
      const scoreArr = comps.map((c) => ({
        competencyId: c.id,
        score: (scores[c.id].score ?? 0) * 20,
        comment: scores[c.id].comment || undefined,
      }));
      await api.post("/api/evaluations", {
        employeeId: profile.id,
        jobTitleId: profile.job_title_id,
        evaluatorType: "self",
        scores: scoreArr,
      });
      toast.success("Self-evaluation submitted!");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit evaluation");
    } finally {
      setSaving(false);
    }
  };

  if (!profile?.job_title_id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Self-evaluation</DialogTitle>
            <DialogDescription>
              You need a job title to create an evaluation.
            </DialogDescription>
          </DialogHeader>
          <Card className="border-warning">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Ask your admin or HR to assign a job title.
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Self-evaluation</DialogTitle>
          <DialogDescription>
            Rate yourself 1-5 on each competency and add optional comments.
          </DialogDescription>
        </DialogHeader>

        {compsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : comps.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No competencies defined for your job title yet. Ask your admin to add them.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {comps.map((c) => {
              const s = scores[c.id] ?? { score: null, comment: "" };
              return (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        {c.description && (
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {c.description}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-primary shrink-0">
                        {s.score != null ? `${s.score} / 5` : "—"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setScore(c.id, v)}
                          className={`flex-1 h-10 rounded-md border text-sm font-semibold transition-colors ${
                            s.score === v
                              ? "bg-accent text-accent-foreground border-accent ring-2 ring-accent"
                              : "bg-muted border-border hover:border-accent hover:bg-accent/10"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      value={s.comment}
                      onChange={(e) => setComment(c.id, e.target.value)}
                      placeholder="Add a comment (optional)…"
                      className="text-sm resize-none h-16"
                    />
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={saving}
                className="flex-1 bg-accent text-accent-foreground"
              >
                {saving ? "Submitting…" : "Submit evaluation"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
