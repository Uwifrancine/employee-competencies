import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
  id: string; status: string;
  quiz: { id: string; title: string; description: string | null; supervisorId: string };
  _count?: { attempts: number };
}

function MyQuizzes() {
  const { user } = useAuth();
  const [items, setItems] = useState<Assignment[]>([]);

  useEffect(() => {
    api.get<Assignment[]>("/api/quiz-assignments").then(setItems).catch(() => {});
  }, []);

  const filteredItems = items.filter((a) => a.quiz.supervisorId !== user?.id);

  return (
    <div>
      <PageHeader title="My Quizzes" subtitle="Quizzes assigned to you by your supervisor." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((a) => (
          <Card key={a.id}><CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><GraduationCap className="size-4" /></div>
              <div className="flex-1">
                <div className="font-medium">{a.quiz?.title}</div>
                {a.quiz?.description && <div className="text-sm text-muted-foreground">{a.quiz.description}</div>}
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.status === "completed" ? (
              <div className="text-sm text-muted-foreground">Completed</div>
            ) : (
              <Link to={`/my-quizzes/${a.id}`}>
                <Button size="sm" className="w-full bg-accent text-accent-foreground">Take quiz</Button>
              </Link>
            )}
          </CardContent></Card>
        ))}
        {filteredItems.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No quizzes assigned to you.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
