import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GraduationCap, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes")({
  ssr: false,
  component: SupervisorQuizzes,
});

interface Quiz { id: string; title: string; description: string | null; createdAt: string }
interface Report { id: string; fullName: string }
interface Assignment {
  id: string; status: string;
  quiz: { id: string; title: string };
  employee: { id: string; fullName: string };
}

function SupervisorQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");

  const load = async () => {
    if (!user) return;
    const [qs, emps] = await Promise.all([
      api.get<Quiz[]>("/api/quizzes"),
      api.get<Report[]>("/api/employees"),
    ]);
    setQuizzes(qs);
    setReports(emps.map((e: any) => ({ id: e.id, fullName: e.fullName })));

    const all = await api.get<Assignment[]>("/api/quiz-assignments");
    setAssignments(all);
  };
  useEffect(() => { load(); }, [user?.id]);

  const submitAssign = async () => {
    if (!assignQuiz || !assignTo) return;
    try {
      await api.post("/api/quiz-assignments", { quizId: assignQuiz.id, employeeId: assignTo });
      toast.success("Quiz assigned");
      setAssignQuiz(null); setAssignTo("");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div>
      <PageHeader
        title="Quizzes"
        subtitle="Create simple quizzes and assign them to your direct reports."
        action={
          <Link to="/supervisor/quizzes/new">
            <Button className="bg-accent text-accent-foreground">
              <Plus className="size-4 mr-1" /> New quiz
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((q) => (
          <Card key={q.id}><CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><GraduationCap className="size-4" /></div>
              <div className="flex-1">
                <div className="font-medium">{q.title}</div>
                {q.description && <div className="text-sm text-muted-foreground mt-0.5">{q.description}</div>}
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setAssignQuiz(q)}>
              <Send className="size-4 mr-1" /> Assign to report
            </Button>
          </CardContent></Card>
        ))}
        {quizzes.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No quizzes yet. Create your first one.</CardContent></Card>
        )}
      </div>

      <div className="mt-8">
        <div className="text-sm font-medium mb-2">Recent assignments</div>
        <Card><CardContent className="p-4 space-y-2">
          {assignments.length === 0 && <div className="text-sm text-muted-foreground">No assignments yet.</div>}
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
              <div>
                <div className="font-medium">{a.quiz?.title}</div>
                <div className="text-muted-foreground text-xs">→ {a.employee?.fullName}</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </CardContent></Card>
      </div>

      <Dialog open={!!assignQuiz} onOpenChange={(o) => !o && setAssignQuiz(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign "{assignQuiz?.title}"</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger><SelectValue placeholder="Pick a direct report" /></SelectTrigger>
              <SelectContent>
                {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={submitAssign} className="w-full bg-accent text-accent-foreground">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
