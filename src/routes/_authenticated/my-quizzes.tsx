import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-quizzes")({
  ssr: false,
  component: MyQuizzes,
});

interface Assignment {
  id: string; status: string; quiz_id: string;
  quizzes?: { title: string; description: string | null };
}
interface Attempt { assignment_id: string; score_pct: number; submitted_at: string }

function MyQuizzes() {
  const { user } = useAuth();
  const [items, setItems] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: a } = await supabase
        .from("quiz_assignments")
        .select("id,status,quiz_id,quizzes(title,description)")
        .eq("employee_id", user.id)
        .order("assigned_at", { ascending: false });
      setItems((a ?? []) as any);
      const { data: at } = await supabase
        .from("quiz_attempts")
        .select("assignment_id,score_pct,submitted_at")
        .eq("employee_id", user.id);
      const map: Record<string, Attempt> = {};
      for (const t of (at ?? []) as Attempt[]) map[t.assignment_id] = t;
      setAttempts(map);
    })();
  }, [user]);

  return (
    <div>
      <PageHeader title="My Quizzes" subtitle="Quizzes assigned to you by your supervisor." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => {
          const attempt = attempts[a.id];
          return (
            <Card key={a.id}><CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><GraduationCap className="size-4" /></div>
                <div className="flex-1">
                  <div className="font-medium">{a.quizzes?.title}</div>
                  {a.quizzes?.description && <div className="text-sm text-muted-foreground">{a.quizzes.description}</div>}
                </div>
                <StatusBadge status={a.status} />
              </div>
              {attempt ? (
                <div className="text-sm">
                  Score: <span className={`font-semibold ${attempt.score_pct >= 60 ? "text-success" : "text-destructive"}`}>{attempt.score_pct.toFixed(0)}%</span>
                </div>
              ) : (
                <Link to="/my-quizzes/$assignmentId" params={{ assignmentId: a.id }}>
                  <Button size="sm" className="w-full bg-accent text-accent-foreground">Take quiz</Button>
                </Link>
              )}
            </CardContent></Card>
          );
        })}
        {items.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No quizzes assigned to you.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
