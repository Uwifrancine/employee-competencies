import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/evaluations/new")({
  ssr: false,
  component: NewEval,
});

interface Comp { id: string; name: string; description: string | null }

interface CompScore {
  score: number | null;
  comment: string;
}

function NewEval() {
  const { profile } = useAuth();
  const [comps, setComps] = useState<Comp[]>([]);
  const [scores, setScores] = useState<Record<string, CompScore>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.job_title_id) return;
    api
      .get<Comp[]>(`/api/competencies?jobTitleId=${profile.job_title_id}`)
      .then((cs) => {
        setComps(cs);
        setScores(Object.fromEntries(cs.map((c) => [c.id, { score: null, comment: "" }])));
      });
  }, [profile?.job_title_id]);

  const setScore = (id: string, v: number) =>
    setScores((s) => ({ ...s, [id]: { ...s[id], score: v } }));

  const setComment = (id: string, v: string) =>
    setScores((s) => ({ ...s, [id]: { ...s[id], comment: v } }));

  const submit = async () => {
    if (!profile?.job_title_id) return;
    const unrated = comps.filter((c) => scores[c.id]?.score == null);
    if (unrated.length) return toast.error("Rate every competency before submitting");
    setSaving(true);
    try {
      const scoreArr = comps.map((c) => ({
        competencyId: c.id,
        score: (scores[c.id].score ?? 0) * 20,
        comment: scores[c.id].comment || undefined,
      }));
      await api.post("/api/evaluations", {
        employeeId: profile.id,
        jobTitleId: profile.job_title_id,
        evaluatorType: "self",
        scores: scoreArr,
      });
      toast.success("Self-evaluation submitted! Your quizzes are ready below.");
      window.location.href = "/my-quizzes";
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!profile?.job_title_id) {
    return (
      <Card className="max-w-xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          You need a job title assigned before you can self-evaluate. Ask your admin or HR.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Self-evaluation"
        subtitle="Rate yourself 1 (needs improvement) → 5 (excellent) and add an optional comment for each competency."
      />

      {comps.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No competencies are defined for your job title yet. Ask your admin to add them.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {comps.map((c) => {
            const s = scores[c.id] ?? { score: null, comment: "" };
            return (
              <Card key={c.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.description && (
                        <div className="text-sm text-muted-foreground mt-0.5">{c.description}</div>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-primary shrink-0">
                      {s.score != null ? `${s.score} / 5` : "—"}
                    </div>
                  </div>

                  {/* Rating buttons */}
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        onClick={() => setScore(c.id, v)}
                        className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${
                          s.score === v
                            ? "bg-accent text-accent-foreground border-accent"
                            : "border-border hover:border-accent"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* Per-competency comment */}
                  <Textarea
                    value={s.comment}
                    onChange={(e) => setComment(c.id, e.target.value)}
                    placeholder="Add a comment (optional)…"
                    className="text-sm resize-none h-16"
                  />
                </CardContent>
              </Card>
            );
          })}

          <Button
            onClick={submit}
            disabled={saving}
            className="w-full bg-accent text-accent-foreground"
          >
            {saving ? "Submitting…" : "Submit evaluation"}
          </Button>
        </div>
      )}
    </div>
  );
}
