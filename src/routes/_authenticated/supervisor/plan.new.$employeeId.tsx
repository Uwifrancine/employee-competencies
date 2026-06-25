import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor/plan/new/$employeeId")({
  ssr: false,
  component: NewPlan,
});

interface Item { action: string; due_date: string }

function NewPlan() {
  const { employeeId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [empName, setEmpName] = useState("");
  const [lastEvalId, setLastEvalId] = useState<string | null>(null);
  const [title, setTitle] = useState("Development plan");
  const [summary, setSummary] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [items, setItems] = useState<Item[]>([{ action: "", due_date: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", employeeId).maybeSingle();
      setEmpName((p as any)?.full_name ?? "");
      const { data: ev } = await supabase.from("evaluations")
        .select("id").eq("employee_id", employeeId).eq("evaluator_type", "supervisor")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setLastEvalId((ev as any)?.id ?? null);
    })();
  }, [employeeId]);

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    const cleanItems = items.filter((i) => i.action.trim());
    setSaving(true);
    const { data: plan, error } = await supabase.from("development_plans").insert({
      employee_id: employeeId, supervisor_id: user.id,
      evaluation_id: lastEvalId, title: title.trim(), summary: summary.trim() || null,
      target_date: targetDate || null,
    }).select("id").single();
    if (error || !plan) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    if (cleanItems.length) {
      const { error: iErr } = await supabase.from("dev_plan_items").insert(
        cleanItems.map((i) => ({ plan_id: plan.id, action: i.action, due_date: i.due_date || null }))
      );
      if (iErr) toast.error(iErr.message);
    }
    setSaving(false);
    toast.success("Development plan created");
    navigate({ to: "/supervisor" });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Development plan for ${empName}`} subtitle="Outline what they should work on and target dates." />
      <Card><CardContent className="p-5 space-y-4">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Context, expectations…" /></div>
        <div><Label>Target completion date</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Action items</Label>
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { action: "", due_date: "" }])}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_180px_auto] gap-2">
                <Input value={it.action} placeholder="Action / task"
                  onChange={(e) => { const c = [...items]; c[idx].action = e.target.value; setItems(c); }} />
                <Input type="date" value={it.due_date}
                  onChange={(e) => { const c = [...items]; c[idx].due_date = e.target.value; setItems(c); }} />
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-destructive p-2"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={submit} disabled={saving} className="w-full bg-accent text-accent-foreground">
          {saving ? "Saving…" : "Create development plan"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
