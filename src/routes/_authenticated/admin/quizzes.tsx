import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, ChevronDown, ChevronRight, BookOpen, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/quizzes")({
  ssr: false,
  component: AdminQuizzes,
});

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  supervisor: { id: string; fullName: string };
  competency: { id: string; name: string; jobTitle: { id: string; name: string } } | null;
  _count: { questions: number; assignments: number };
}

interface QuizDetail {
  id: string;
  title: string;
  questions: {
    id: string;
    prompt: string;
    questionType: string;
    orderIndex: number;
    choices: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
  }[];
}

function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, QuizDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    api.get<Quiz[]>("/api/quizzes")
      .then(setQuizzes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (quizId: string) => {
    if (expanded === quizId) {
      setExpanded(null);
      return;
    }
    setExpanded(quizId);
    if (!details[quizId]) {
      setLoadingDetail(quizId);
      try {
        const d = await api.get<QuizDetail>(`/api/quizzes/${quizId}`);
        setDetails((prev) => ({ ...prev, [quizId]: d }));
      } catch {}
      setLoadingDetail(null);
    }
  };

  // Group by competency
  const grouped: Record<string, { label: string; jobTitle: string; quizzes: Quiz[] }> = {};
  const noCompetency: Quiz[] = [];

  for (const q of quizzes) {
    if (q.competency) {
      const key = q.competency.id;
      if (!grouped[key]) {
        grouped[key] = { label: q.competency.name, jobTitle: q.competency.jobTitle.name, quizzes: [] };
      }
      grouped[key].quizzes.push(q);
    } else {
      noCompetency.push(q);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Quizzes" subtitle="All quizzes created across the organisation." />
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const renderQuizCard = (q: Quiz) => {
    const isOpen = expanded === q.id;
    const detail = details[q.id];
    const isLoadingThis = loadingDetail === q.id;
    return (
      <Card key={q?.id}>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => toggle(q?.id)}
            className="w-full flex items-start gap-3 p-5 text-left hover:bg-muted/30 transition-colors rounded-lg"
          >
            <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0 mt-0.5">
              <GraduationCap className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{q?.title}</div>
              {q?.description && (
                <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{q.description}</div>
              )}
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {q?.supervisor?.fullName}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="size-3" />
                  {q?._count?.questions} question{q?._count?.questions !== 1 ? "s" : ""}
                </span>
                <span>{q?._count?.assignments} assignment{q?._count?.assignments !== 1 ? "s" : ""}</span>
                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {isOpen
              ? <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-1" />
              : <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />}
          </button>

          {isOpen && (
            <div className="border-t border-border px-5 pb-5 pt-3 space-y-3">
              {isLoadingThis && <div className="text-sm text-muted-foreground">Loading questions…</div>}
              {detail && detail.questions?.length === 0 && (
                <div className="text-sm text-muted-foreground">No questions yet.</div>
              )}
              {detail?.questions
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((question, qi) => (
                  <div key={question?.id} className="text-sm">
                    <div className="font-medium text-foreground">
                      {qi + 1}. {question?.prompt}
                      <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">
                        ({question?.questionType === "multipleChoice" ? "multiple choice" : question.questionType})
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {question?.choices
                        .slice()
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((c) => (
                          <li key={c.id} className={`flex items-center gap-1.5 ${c.isCorrect ? "text-success font-medium" : "text-muted-foreground"}`}>
                            <span className={`inline-block size-2 rounded-full ${c.isCorrect ? "bg-success" : "bg-border"}`} />
                            {c.text}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Quizzes"
        subtitle={`${quizzes?.length} quiz${quizzes?.length !== 1 ? "zes" : ""} across the organisation. Click a quiz to preview questions.`}
      />

      {quizzes?.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No quizzes have been created yet. Supervisors create quizzes from Team Management.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {Object?.entries(grouped).map(([cId, group]) => (
          <section key={cId}>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-semibold">{group?.label}</div>
              <div className="text-xs text-muted-foreground">· {group?.jobTitle}</div>
              <div className="h-px flex-1 bg-border" />
              <div className="text-xs text-muted-foreground">{group?.quizzes?.length} quiz{group?.quizzes?.length !== 1 ? "zes" : ""}</div>
            </div>
            <div className="space-y-2">{group?.quizzes?.map(renderQuizCard)}</div>
          </section>
        ))}

        {noCompetency?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-semibold text-muted-foreground">No competency linked</div>
              <div className="h-px flex-1 bg-border" />
              <div className="text-xs text-muted-foreground">{noCompetency?.length}</div>
            </div>
            <div className="space-y-2">{noCompetency?.map(renderQuizCard)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
