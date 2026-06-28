import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Evaluation {
  id: string;
  evaluatorType: string;
  createdAt: string;
  overallPercent: number;
  scores: {
    id: string;
    score: number;
    competency: { id: string; name: string };
    comment?: string;
  }[];
}

interface EmployeeEvaluationDialogProps {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeEvaluationDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: EmployeeEvaluationDialogProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !employeeId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    api
      .get<Evaluation[]>(`/api/reports/individual/${employeeId}`)
      .then((res: any) => {
        setEvaluations(res.evaluations || []);
      })
      .catch((e) => {
        toast.error("Failed to load evaluations: " + e.message);
        setEvaluations([]);
      })
      .finally(() => setLoading(false));
  }, [open, employeeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>Evaluations - {employeeName}</DialogTitle>
          <DialogDescription>
            View all evaluations for this employee
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : evaluations.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground text-center py-8">
              No evaluations yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {evaluations.map((evaluation) => (
              <Card key={evaluation.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base capitalize">
                        {evaluation.evaluatorType} evaluation
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {evaluation.overallPercent.toFixed(0)}%
                      </div>
                      <div className={`text-xs font-semibold ${evaluation.overallPercent >= 60 ? "text-green-600" : "text-red-600"}`}>
                        {evaluation.overallPercent >= 60 ? "PASS" : "FAIL"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {evaluation.scores.map((score) => (
                    <div key={score.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{score.competency.name}</div>
                        <div className="text-sm font-semibold text-accent">
                          {(score.score / 20).toFixed(0)}/5
                        </div>
                      </div>
                      {score.comment && (
                        <div className="text-sm text-muted-foreground">
                          {score.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
