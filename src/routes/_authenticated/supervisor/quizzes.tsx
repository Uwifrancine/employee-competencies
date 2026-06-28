import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizCreationDialog } from "@/components/QuizCreationDialog";
import { Plus, GraduationCap, Send, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes")({
  ssr: false,
  component: SupervisorQuizzes,
});

interface Quiz {
  id: string; title: string; description: string | null; createdAt: string;
  competency: { id: string; name: string } | null;
}
interface Report {
  id: string; fullName: string; jobTitleId?: string; jobTitle?: { id: string; name: string }
}
interface JobTitle { id: string; name: string }
interface Assignment {
  id: string; status: string; isVisible: boolean;
  quiz: { id: string; title: string };
  employee: { id: string; fullName: string };
}

function SupervisorQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");
  const [assignMode, setAssignMode] = useState<"employee" | "jobtitle">("employee");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [qs, emps, jts] = await Promise.all([
      api.get<Quiz[]>("/api/quizzes"),
      api.get<Report[]>("/api/employees"),
      api.get<JobTitle[]>("/api/job-titles"),
    ]);
    setQuizzes(qs);
    setReports(emps.map((e: any) => ({
      id: e.id,
      fullName: e.fullName,
      jobTitleId: e.jobTitle?.id || e.jobTitleId,
      jobTitle: e.jobTitle,
    })));
    setJobTitles(jts);

    const all = await api.get<Assignment[]>("/api/quiz-assignments");
    setAssignments(all);
  };
  useEffect(() => { load(); }, [user?.id]);

  const submitAssign = async () => {
    if (!assignQuiz) return;

    if (assignMode === "employee" && !assignTo) return;
    if (assignMode === "jobtitle" && !selectedJobTitle) return;

    try {
      if (assignMode === "employee") {
        await api.post("/api/quiz-assignments", { quizId: assignQuiz.id, employeeId: assignTo });
        toast.success("Quiz assigned to employee");
      } else {
        // Assign to all employees with this job title
        const employeesWithJobTitle = reports.filter((r: any) => r.jobTitleId === selectedJobTitle);
        if (employeesWithJobTitle.length === 0) {
          toast.error("No employees found with this job title");
          return;
        }

        await Promise.all(
          employeesWithJobTitle.map((emp: any) =>
            api.post("/api/quiz-assignments", { quizId: assignQuiz.id, employeeId: emp.id })
          )
        );
        toast.success(`Quiz assigned to ${employeesWithJobTitle.length} employee(s)`);
      }

      setAssignQuiz(null);
      setAssignTo("");
      setSelectedJobTitle("");
      setAssignMode("employee");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const toggleVisibility = async (a: Assignment) => {
    try {
      await api.patch(`/api/quiz-assignments/${a.id}/visibility`, { isVisible: !a.isVisible });
      setAssignments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, isVisible: !a.isVisible } : x))
      );
      toast.success(a.isVisible ? "Hidden from employee" : "Now visible to employee");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Quizzes"
        subtitle="Create quizzes and assign them to your direct reports."
        action={
          <Button
            className="bg-accent text-accent-foreground"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="size-4 mr-1" /> New quiz
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((q) => (
          <Card key={q.id}><CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                <GraduationCap className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{q.title}</div>
                {q.competency && (
                  <div className="text-xs text-accent font-medium mt-0.5">{q.competency.name}</div>
                )}
                {q.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{q.description}</div>
                )}
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
        <div className="text-sm font-medium mb-2">Assignments</div>
        <Card><CardContent className="p-4 space-y-2">
          {assignments.length === 0 && <div className="text-sm text-muted-foreground">No assignments yet.</div>}
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2 gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.quiz?.title}</div>
                <div className="text-muted-foreground text-xs">→ {a.employee?.fullName}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={a.status} />
                <button
                  type="button"
                  title={a.isVisible ? "Visible to employee — click to hide" : "Hidden from employee — click to show"}
                  onClick={() => toggleVisibility(a)}
                  className={`p-1 rounded transition-colors ${
                    a.isVisible
                      ? "text-accent hover:text-accent/70"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            </div>
          ))}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground mt-1">
          Use the <Eye className="size-3 inline" /> / <EyeOff className="size-3 inline" /> icon to show or hide a quiz from the employee.
        </p>
      </div>

      <Dialog open={!!assignQuiz} onOpenChange={(o) => !o && setAssignQuiz(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign "{assignQuiz?.title}"</DialogTitle>
            <DialogDescription>
              Choose to assign to a specific employee or to all employees with a job title
            </DialogDescription>
          </DialogHeader>

          <Tabs value={assignMode} onValueChange={(v) => setAssignMode(v as "employee" | "jobtitle")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="employee">Individual Employee</TabsTrigger>
              <TabsTrigger value="jobtitle">By Job Title</TabsTrigger>
            </TabsList>

            <TabsContent value="employee" className="space-y-3">
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger><SelectValue placeholder="Pick a direct report" /></SelectTrigger>
                <SelectContent>
                  {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={submitAssign} className="w-full bg-accent text-accent-foreground" disabled={!assignTo}>
                Assign to Employee
              </Button>
            </TabsContent>

            <TabsContent value="jobtitle" className="space-y-3">
              <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                <SelectTrigger><SelectValue placeholder="Select a job title" /></SelectTrigger>
                <SelectContent>
                  {jobTitles.map((jt) => <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This will assign the quiz to all employees with the selected job title.
              </p>
              <Button onClick={submitAssign} className="w-full bg-accent text-accent-foreground" disabled={!selectedJobTitle}>
                Assign to Job Title
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <QuizCreationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={load}
      />
    </div>
  );
}
