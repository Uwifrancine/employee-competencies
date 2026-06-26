import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GraduationCap, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/quizzes")({
  ssr: false,
  component: SupervisorQuizzes,
});

interface Quiz { id: string; title: string; description: string | null; created_at: string }
interface Report { id: string; full_name: string }
interface Assignment { id: string; quiz_id: string; employee_id: string; status: string; quizzes?: { title: string }; profiles?: { full_name: string } }

function SupervisorQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");

  const load = async () => {
    if (!user) return;
    const [{ data: q }, { data: r }] = await Promise.all([
      supabase.from("quizzes").select("*").eq("supervisor_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name").eq("supervisor_id", user.id).order("full_name"),
    ]);
    setQuizzes((q ?? []) as Quiz[]);
    setReports((r ?? []) as Report[]);

    const quizIds = (q ?? []).map((x: any) => x.id);
    if (quizIds.length) {
      const { data: a } = await supabase
        .from("quiz_assignments")
        .select("id,quiz_id,employee_id,status,quizzes(title),profiles!quiz_assignments_employee_id_fkey(full_name)")
        .in("quiz_id", quizIds)
        .order("assigned_at", { ascending: false });
      setAssignments((a ?? []) as any);
    } else setAssignments([]);
  };
  useEffect(() => { load(); }, [user]);

  const submitAssign = async () => {
    if (!assignQuiz || !assignTo || !user) return;
    const { error } = await supabase.from("quiz_assignments").insert({
      quiz_id: assignQuiz.id, employee_id: assignTo, assigned_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Quiz assigned");
    setAssignQuiz(null); setAssignTo("");
    load();
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
                <div className="font-medium">{a.quizzes?.title}</div>
                <div className="text-muted-foreground text-xs">→ {a.profiles?.full_name}</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </CardContent></Card>
      </div>

      <Dialog open={!!assignQuiz} onOpenChange={(o) => !o && setAssignQuiz(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign “{assignQuiz?.title}”</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger><SelectValue placeholder="Pick a direct report" /></SelectTrigger>
              <SelectContent>
                {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={submitAssign} className="w-full bg-accent text-accent-foreground">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
