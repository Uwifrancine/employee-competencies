import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/evaluations/new")({
  ssr: false,
  component: NewEval,
});

interface Comp { id: string; name: string; description: string | null }

function NewEval() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [comps, setComps] = useState<Comp[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.job_title_id) return;
    supabase.from("competencies").select("*").eq("job_title_id", profile.job_title_id).order("name")
      .then(({ data }) => setComps((data ?? []) as Comp[]));
  }, [profile?.job_title_id]);

  const submit = async () => {
    if (!user || !profile?.job_title_id) return;
    if (comps.some((c) => !scores[c.id])) return toast.error("Score every competency");
    setSaving(true);
    const total = comps.reduce((s, c) => s + scores[c.id], 0);
    const overall = (total / (comps.length * 5)) * 100;
    const { data: ev, error } = await supabase.from("evaluations").insert({
      employee_id: user.id, evaluator_id: user.id, evaluator_type: "self",
      job_title_id: profile.job_title_id, overall_percent: overall, notes: notes || null,
    }).select("id").single();
    if (error || !ev) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const items = comps.map((c) => ({ evaluation_id: ev.id, competency_id: c.id, score: scores[c.id] }));
    const { error: sErr } = await supabase.from("evaluation_scores").insert(items);
    setSaving(false);
    if (sErr) return toast.error(sErr.message);
    toast.success(`Submitted. Overall: ${overall.toFixed(1)}%`);
    navigate({ to: "/evaluations" });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Self-evaluation" subtitle="Rate yourself on each competency (1 = needs improvement, 5 = excellent)." />
      {comps.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No competencies defined for your job title yet.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-5 space-y-5">
          {comps.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.description && <div className="text-sm text-muted-foreground">{c.description}</div>}
                </div>
                <div className="text-sm font-medium text-primary">{scores[c.id] ?? "—"} / 5</div>
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
      )}
    </div>
  );
}
