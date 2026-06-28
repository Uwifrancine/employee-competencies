import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Competency { id: string; name: string; description: string | null }
interface Employee { id: string; fullName: string; jobTitle: { id: string; name: string } | null }

interface EvaluateDialogProps {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EvaluateDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  onSuccess,
}: EvaluateDialogProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employeeId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const emp = await api.get<Employee>(`/api/employees/${employeeId}`);
        if (!emp.jobTitle) {
          toast.error("Employee has no job title assigned");
          return;
        }

        const comps = await api.get<Competency[]>(`/api/competencies?jobTitleId=${emp.jobTitle.id}`);
        setCompetencies(comps);
        setScores({});
        setNotes("");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load competencies");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, employeeId]);

  const submit = async () => {
    if (!employeeId) return;
    if (competencies.some((c) => !scores[c.id])) {
      toast.error("Score every competency 1-5");
      return;
    }

    setSaving(true);
    try {
      const emp = await api.get<Employee>(`/api/employees/${employeeId}`);
      if (!emp.jobTitle) return;

      const scoreArr = competencies.map((c) => ({
        competencyId: c.id,
        score: scores[c.id] * 20,
      }));

      const ev = await api.post<any>("/api/evaluations", {
        employeeId,
        jobTitleId: emp.jobTitle.id,
        evaluatorType: "supervisor",
        notes: notes || undefined,
        scores: scoreArr,
      });

      toast.success(`Submitted. Overall: ${ev.overallPercent.toFixed(1)}%`);
      onOpenChange(false);
      setScores({});
      setNotes("");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit evaluation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evaluate: {employeeName}</DialogTitle>
          <DialogDescription>
            Score each competency 1–5. This creates a supervisor evaluation.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Competencies */}
            <div className="space-y-3">
              {competencies.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-2">
                    <div>
                      <Label className="font-medium">{c.name}</Label>
                      {c.description && (
                        <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Button
                          key={rating}
                          size="sm"
                          variant={scores[c.id] === rating ? "default" : "outline"}
                          onClick={() => setScores((s) => ({ ...s, [c.id]: rating }))}
                          className="flex-1"
                        >
                          {rating}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any feedback or comments…"
                className="h-24"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={saving || competencies.some((c) => !scores[c.id])}
                className="flex-1 bg-accent text-accent-foreground"
              >
                {saving ? "Submitting…" : "Submit Evaluation"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
