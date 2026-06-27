import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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

interface ActionItem { action: string; dueDate: string }

function NewPlan() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const [empName, setEmpName] = useState("");
  const [lastEvalId, setLastEvalId] = useState<string | null>(null);
  const [title, setTitle] = useState("Development plan");
  const [summary, setSummary] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [items, setItems] = useState<ActionItem[]>([{ action: "", dueDate: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const emp = await api.get<{ fullName: string }>(`/api/employees/${employeeId}`);
      setEmpName(emp.fullName);

      const evals = await api.get<any[]>("/api/evaluations");
      const lastSup = evals
        .filter((e) => e.employee?.id === employeeId && e.evaluatorType === "supervisor")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      setLastEvalId(lastSup?.id ?? null);
    })();
  }, [employeeId]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    const cleanItems = items.filter((i) => i.action.trim());
    setSaving(true);
    try {
      const plan = await api.post<{ id: string }>("/api/development-plans", {
        employeeId,
        title: title.trim(),
        summary: summary.trim() || undefined,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        evaluationId: lastEvalId ?? undefined,
      });
      for (const i of cleanItems) {
        await api.post(`/api/development-plans/${plan.id}/items`, {
          action: i.action,
          dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : undefined,
        });
      }
      toast.success("Development plan created");
      navigate({ to: "/supervisor" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
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
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { action: "", dueDate: "" }])}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_180px_auto] gap-2">
                <Input value={it.action} placeholder="Action / task"
                  onChange={(e) => { const c = [...items]; c[idx].action = e.target.value; setItems(c); }} />
                <Input type="date" value={it.dueDate}
                  onChange={(e) => { const c = [...items]; c[idx].dueDate = e.target.value; setItems(c); }} />
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
