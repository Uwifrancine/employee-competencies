import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { QuizTaker } from "@/components/QuizTaker";

interface PendingQuiz {
  id: string;
  title: string;
  description: string | null;
  quiz: { id: string; title: string; description: string | null };
}

export function PendingQuizDialog() {
  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [takingQuizId, setTakingQuizId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingQuizzes();
  }, []);

  const loadPendingQuizzes = async () => {
    try {
      const assignments = await api.get<any[]>("/api/quiz-assignments");
      const pending = assignments.filter((a) => a.status === "pending");
      setPendingQuizzes(pending);
    } catch (e) {
      console.error("Failed to load pending quizzes:", e);
    }
  };

  if (pendingQuizzes.length === 0) {
    return null;
  }

  const takingQuiz = pendingQuizzes.find((q) => q.id === takingQuizId);

  if (takingQuizId && takingQuiz) {
    return (
      <div className="mb-6">
        <QuizTaker
          assignmentId={takingQuizId}
          quizTitle={takingQuiz.quiz.title}
          quizDescription={takingQuiz.quiz.description}
          onComplete={() => {
            setTakingQuizId(null);
            loadPendingQuizzes();
          }}
          onCancel={() => setTakingQuizId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <Card className="border-accent/50 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-accent" />
            📋 Quizzes Ready to Take
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingQuizzes.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-4 p-3 rounded-lg bg-white border border-border hover:border-accent transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{a.quiz?.title}</div>
                {a.quiz?.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {a.quiz.description}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                className="bg-accent text-accent-foreground flex-shrink-0"
                onClick={() => setTakingQuizId(a.id)}
              >
                Take Now
              </Button>
            </div>
          ))}
          <div className="text-xs text-muted-foreground pt-2">
            You have {pendingQuizzes.length} quiz{pendingQuizzes.length !== 1 ? "zes" : ""} to complete
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
