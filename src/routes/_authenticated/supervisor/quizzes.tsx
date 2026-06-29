import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizCreationDialog } from "@/components/QuizCreationDialog";
import { QuizEditDialog } from "@/components/QuizEditDialog";
import { Plus, GraduationCap, Send, Eye, EyeOff, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes")({
  ssr: false,
  component: SupervisorQuizzes,
});

interface Quiz {
  id: string; title: string; description: string | null; createdAt: string;
  competency: { id: string; name: string; jobTitle?: { id: string; name: string } } | null;
  jobTitle: { id: string; name: string } | null;
  supervisorId: string;
  _count?: { questions: number; assignments: number };
}

interface QuizDetail {
  id: string; title: string;
  questions: {
    id: string; prompt: string; questionType: string; orderIndex: number;
    choices: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
  }[];
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
  const [selectedJobTitleFilter, setSelectedJobTitleFilter] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<QuizDetail | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

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

  // Filter team job titles
  const teamJobTitles = Array.from(
    new Map(reports.map(r => [r.jobTitleId, r.jobTitle])).values()
  ).filter(Boolean) as JobTitle[];

  const filteredQuizzes = selectedJobTitleFilter
    ? quizzes.filter(q => q.jobTitle?.id === selectedJobTitleFilter || q.competency?.jobTitle?.id === selectedJobTitleFilter)
    : quizzes;

  const hasOpenAssignmentsForJobTitle = selectedJobTitleFilter
    ? assignments.some(a => {
        const quiz = quizzes.find(q => q.id === a.quiz?.id);
        return quiz && (quiz.jobTitle?.id === selectedJobTitleFilter || quiz.competency?.jobTitle?.id === selectedJobTitleFilter) && a.status !== "completed";
      })
    : false;

  const openPreview = async (quizId: string) => {
    setLoadingPreview(true);
    try {
      const d = await api.get<QuizDetail>(`/api/quizzes/${quizId}`);
      setPreviewQuiz(d);
    } catch {
      toast.error("Failed to load quiz");
    } finally {
      setLoadingPreview(false);
    }
  };

  const submitAssign = async () => {
    if (!assignQuiz) return;

    if (assignMode === "employee" && !assignTo) return;
    if (assignMode === "jobtitle" && !selectedJobTitle) return;

    try {
      if (assignMode === "employee") {
        if (assignTo === assignQuiz.supervisorId) {
          toast.error("Cannot assign quiz to yourself");
          return;
        }
        await api.post("/api/quiz-assignments", { quizId: assignQuiz.id, employeeId: assignTo });
        toast.success("Quiz assigned to employee");
      } else {
        const employeesWithJobTitle = reports.filter(
          (r: any) => r.jobTitleId === selectedJobTitle && r.id !== assignQuiz.supervisorId
        );
        if (employeesWithJobTitle.length === 0) {
          toast.error("No employees found with this job title (excluding quiz creator)");
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

  const deleteQuiz = async () => {
    if (!deletingQuizId) return;
    try {
      await api.delete(`/api/quizzes/${deletingQuizId}`);
      toast.success("Quiz deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingQuizId(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete quiz");
    }
  };

  return (
    <div>
      <PageHeader
        title="Quiz Management"
        subtitle="Create quizzes and assign them to your team by job title."
      />

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        {/* Left Sidebar - Job Titles */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Job Titles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedJobTitleFilter("")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                  !selectedJobTitleFilter
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">All Quizzes</div>
                <div className={`text-xs ${!selectedJobTitleFilter ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}
                </div>
              </button>
              {teamJobTitles.map((jt) => {
                const count = reports.filter((r) => r.jobTitleId === jt.id).length;
                const isSelected = selectedJobTitleFilter === jt.id;
                return (
                  <button
                    key={jt.id}
                    onClick={() => setSelectedJobTitleFilter(jt.id)}
                    className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-sm">{jt.name}</div>
                    <div className={`text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {count} member{count !== 1 ? "s" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Main Area - Quizzes */}
        <div className="space-y-6">
          {/* Quizzes Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {selectedJobTitleFilter
                  ? teamJobTitles.find(j => j.id === selectedJobTitleFilter)?.name
                  : "All Quizzes"}
              </h3>
              {selectedJobTitleFilter && (
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-accent text-accent-foreground"
                  size="sm"
                  disabled={hasOpenAssignmentsForJobTitle}
                  title={hasOpenAssignmentsForJobTitle ? "Finish all pending assignments before creating a new quiz" : ""}
                >
                  <Plus className="size-3 mr-1" /> Create Quiz
                </Button>
              )}
            </div>
            {hasOpenAssignmentsForJobTitle && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                ⚠️ Employees are still completing quiz assignments. Please wait for all assignments to be finished before creating a new quiz.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredQuizzes.map((q) => (
                <Card key={q.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                        <GraduationCap className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{q.title}</div>
                        {q.description && (
                          <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{q.description}</div>
                        )}
                        {q._count && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {q._count.questions} question{q._count.questions !== 1 ? "s" : ""} · {q._count.assignments} assigned
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openPreview(q.id)}>
                        <BookOpen className="size-3.5 mr-1" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setAssignQuiz(q)}>
                        <Send className="size-3.5 mr-1" /> Assign
                      </Button>
                      {q.supervisorId === user?.id && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditingQuizId(q.id)} title="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingQuizId(q.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete"
                          >
                            🗑️
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredQuizzes.length === 0 && (
                <div className="col-span-2 text-sm text-muted-foreground">
                  No quizzes yet. Click "New Quiz" to create one.
                </div>
              )}
            </div>
          </div>

          {/* Assignments */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Assignments</h3>
            <Card>
              <CardContent className="p-4 space-y-2">
                {assignments.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No assignments yet. Click <strong>Assign</strong> on a quiz card above.
                  </div>
                )}
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
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-1">
              Use the <Eye className="size-3 inline" /> / <EyeOff className="size-3 inline" /> icon to show or hide a quiz.
            </p>
          </div>
        </div>
      </div>

      {/* Assign dialog */}
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
                  {reports.filter((r) => r.id !== assignQuiz?.supervisorId).map((r) => <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={submitAssign} className="w-full bg-accent text-accent-foreground" disabled={!assignTo}>
                Assign to Employee
              </Button>
            </TabsContent>

            <TabsContent value="jobtitle" className="space-y-3">
              <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                <SelectTrigger><SelectValue placeholder="Pick a job title" /></SelectTrigger>
                <SelectContent>
                  {teamJobTitles.map((jt) => <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
        onSuccess={() => {
          load();
          setCreateDialogOpen(false);
        }}
        jobTitle={selectedJobTitleFilter ? teamJobTitles.find(j => j.id === selectedJobTitleFilter)?.name : undefined}
        jobTitleId={selectedJobTitleFilter}
      />

      {/* Quiz preview dialog */}
      <Dialog open={!!previewQuiz} onOpenChange={(o) => !o && setPreviewQuiz(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewQuiz?.title}</DialogTitle>
          </DialogHeader>
          {previewQuiz && (
            <div className="space-y-4">
              {previewQuiz.questions.map((q, idx) => (
                <div key={q.id} className="border-b pb-4 last:border-0">
                  <div className="font-medium text-sm">Q{idx + 1}: {q.prompt}</div>
                  {q.choices && q.choices.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {q.choices.map((c) => (
                        <div key={c.id} className="text-sm text-muted-foreground pl-4">
                          {c.text} {c.isCorrect && <span className="text-green-600 font-medium">(Correct)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quiz?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this quiz? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingQuizId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteQuiz}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit quiz dialog */}
      {editingQuizId && (
        <QuizEditDialog
          open={!!editingQuizId}
          onOpenChange={(open) => !open && setEditingQuizId(null)}
          quizId={editingQuizId}
          initialTitle={quizzes.find(q => q.id === editingQuizId)?.title || ""}
          initialDescription={quizzes.find(q => q.id === editingQuizId)?.description || null}
          onSuccess={() => {
            setEditingQuizId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
