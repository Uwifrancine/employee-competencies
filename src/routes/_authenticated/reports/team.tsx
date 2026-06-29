import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/team")({
  ssr: false,
  component: TeamReport,
});

interface Member {
  id: string; fullName: string;
  latestEvalScore: number | null; openDevPlans: number;
  avgQuizScore: number | null;
}

interface EvalWithQuiz {
  id: string;
  overallPercent: number;
  evaluatorType: string;
  createdAt: string;
  quizScore?: number | null;
}

function TeamReport() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberEvals, setMemberEvals] = useState<EvalWithQuiz[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingEvals, setLoadingEvals] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ members: Member[] }>(`/api/reports/team/${user.id}`)
      .then((r) => setMembers(r.members))
      .catch(() => {});
  }, [user?.id]);

  const openEvaluations = async (member: Member) => {
    setSelectedMember(member);
    setLoadingEvals(true);
    try {
      const [evals, assignments] = await Promise.all([
        api.get<any[]>("/api/evaluations"),
        api.get<any[]>("/api/quiz-assignments"),
      ]);

      const memberEvals = evals.filter((e) => e.employee?.id === member.id);
      const memberAssignments = assignments.filter((a) => a.employee?.id === member.id && a.attempts?.length > 0);

      const evalsWithQuiz: EvalWithQuiz[] = memberEvals.map((e) => {
        const quiz = memberAssignments.find((a) => a.assignedAt <= new Date(e.createdAt));
        return {
          id: e.id,
          overallPercent: e.overallPercent,
          evaluatorType: e.evaluatorType,
          createdAt: e.createdAt,
          quizScore: quiz?.attempts?.[0]?.scorePct ?? null,
        };
      });

      setMemberEvals(evalsWithQuiz.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setShowModal(true);
    } catch (err) {
      console.error("Failed to load evaluations:", err);
    } finally {
      setLoadingEvals(false);
    }
  };

  const cell = (v: number | null) =>
    v === null ? <span className="text-muted-foreground">—</span> :
      <span className={`font-semibold ${v >= 60 ? "text-success" : "text-destructive"}`}>{v.toFixed(0)}%</span>;

  return (
    <div>
      <PageHeader title="Team Report" subtitle="Snapshot of every direct report." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Latest eval</TableHead>
            <TableHead>Open dev plans</TableHead><TableHead>Quiz avg</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {members.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell>{cell(r.latestEvalScore)}</TableCell>
                <TableCell>{r.openDevPlans}</TableCell>
                <TableCell>{cell(r.avgQuizScore)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEvaluations(r)}
                  >
                    <Eye className="size-4 mr-1" /> Evaluations
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No direct reports.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Evaluations Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
          {selectedMember && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selectedMember.fullName} - Evaluations</DialogTitle>
              </DialogHeader>

              {loadingEvals ? (
                <div className="text-center text-muted-foreground">Loading evaluations...</div>
              ) : memberEvals.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No evaluations found.</div>
              ) : (
                <div className="space-y-3">
                  {memberEvals.map((e) => (
                    <Card key={e.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium capitalize">{e.evaluatorType} Evaluation</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(e.createdAt).toLocaleDateString()} · {new Date(e.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Score: </span>
                              <span className={`font-semibold text-lg ${e.overallPercent >= 60 ? "text-success" : "text-destructive"}`}>
                                {e.overallPercent.toFixed(0)}%
                              </span>
                            </div>
                            {e.quizScore !== null && (
                              <div className="text-sm">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <GraduationCap className="size-3" /> Quiz:
                                </span>
                                <span className={`font-semibold ${e.quizScore >= 60 ? "text-success" : "text-destructive"}`}>
                                  {e.quizScore.toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
