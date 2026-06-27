import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/evaluate/$employeeId")({
  ssr: false,
  component: SupervisorEval,
});

interface Comp { id: string; name: string; description: string | null }
interface Emp { id: string; fullName: string; jobTitle: { id: string; name: string } | null }

function SupervisorEval() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await api.get<Emp>(`/api/employees/${employeeId}`);
      setEmp(e);
      if (!e.jobTitle) return;

      const cs = await api.get<Comp[]>(`/api/competencies?jobTitleId=${e.jobTitle.id}`);
      setComps(cs);

      // Load last self-evaluation scores
      const evals = await api.get<any[]>("/api/evaluations");
      const lastSelf = evals
        .filter((x) => x.employee?.id === employeeId && x.evaluatorType === "self")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (lastSelf) {
        const full = await api.get<any>(`/api/evaluations/${lastSelf.id}`);
        const map: Record<string, number> = {};
        for (const s of full.scores ?? []) map[s.competency.id] = Math.round(s.score / 20);
        setSelfScores(map);
      }
    })();
  }, [employeeId]);

  const submit = async () => {
    if (!emp?.jobTitle) return;
    if (comps.some((c) => !scores[c.id])) return toast.error("Score every competency");
    setSaving(true);
    try {
      const scoreArr = comps.map((c) => ({ competencyId: c.id, score: scores[c.id] * 20 }));
      const ev = await api.post<any>("/api/evaluations", {
        employeeId: emp.id,
        jobTitleId: emp.jobTitle.id,
        evaluatorType: "supervisor",
        notes: notes || undefined,
        scores: scoreArr,
      });
      toast.success(`Submitted. Overall: ${ev.overallPercent.toFixed(1)}%`);
      if (ev.overallPercent < 60) navigate({ to: "/supervisor/plan/new/$employeeId", params: { employeeId } });
      else navigate({ to: "/supervisor" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!emp) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Evaluate: ${emp.fullName}`} subtitle="Score each competency 1–5. Self-eval scores are shown for reference." />
      <Card><CardContent className="p-5 space-y-5">
        {comps.map((c) => (
          <div key={c.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-sm text-muted-foreground">{c.description}</div>}
              </div>
              <div className="text-xs text-muted-foreground">
                Self: <span className="font-medium text-foreground">{selfScores[c.id] ?? "—"}</span> · Yours:{" "}
                <span className="font-medium text-primary">{scores[c.id] ?? "—"}</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => setScores({ ...scores, [c.id]: v })}
                  className={`flex-1 h-10 rounded-md border text-sm font-medium ${scores[c.id] === v
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border hover:border-accent"}`}>{v}</button>
              ))}
            </div>
          </div>
        ))}
        <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button onClick={submit} disabled={saving} className="w-full bg-accent text-accent-foreground">
          {saving ? "Submitting…" : "Submit evaluation"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
