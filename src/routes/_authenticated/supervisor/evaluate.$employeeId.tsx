import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
interface Emp { id: string; full_name: string; job_title_id: string | null }

function SupervisorEval() {
  const { employeeId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from("profiles").select("id,full_name,job_title_id").eq("id", employeeId).maybeSingle();
      if (!e) return;
      setEmp(e as Emp);
      if (!e.job_title_id) return;
      const { data: cs } = await supabase.from("competencies").select("*").eq("job_title_id", e.job_title_id).order("name");
      setComps((cs ?? []) as Comp[]);
      // last self
      const { data: last } = await supabase.from("evaluations")
        .select("id").eq("employee_id", employeeId).eq("evaluator_type", "self")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last) {
        const { data: sc } = await supabase.from("evaluation_scores").select("competency_id,score").eq("evaluation_id", last.id);
        const map: Record<string, number> = {};
        for (const r of sc ?? []) map[(r as any).competency_id] = (r as any).score;
        setSelfScores(map);
      }
    })();
  }, [employeeId]);

  const submit = async () => {
    if (!user || !emp?.job_title_id) return;
    if (comps.some((c) => !scores[c.id])) return toast.error("Score every competency");
    setSaving(true);
    const total = comps.reduce((s, c) => s + scores[c.id], 0);
    const overall = (total / (comps.length * 5)) * 100;
    const { data: ev, error } = await supabase.from("evaluations").insert({
      employee_id: emp.id, evaluator_id: user.id, evaluator_type: "supervisor",
      job_title_id: emp.job_title_id, overall_percent: overall, notes: notes || null,
    }).select("id").single();
    if (error || !ev) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const items = comps.map((c) => ({ evaluation_id: ev.id, competency_id: c.id, score: scores[c.id] }));
    await supabase.from("evaluation_scores").insert(items);
    setSaving(false);
    toast.success(`Submitted. Overall: ${overall.toFixed(1)}%`);
    if (overall < 60) navigate({ to: "/supervisor/plan/new/$employeeId", params: { employeeId } });
    else navigate({ to: "/supervisor" });
  };

  if (!emp) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Evaluate: ${emp.full_name}`} subtitle="Score each competency 1–5. Self-eval scores are shown for reference." />
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
