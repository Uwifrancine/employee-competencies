import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sprout, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/development-plans")({
  ssr: false,
  component: PlansPage,
});

interface Item { id: string; action: string; dueDate: string | null; status: string }
interface Plan {
  id: string; title: string; summary: string | null; status: string;
  targetDate: string | null; createdAt: string; items: Item[];
}

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  const load = async () => {
    const data = await api.get<any[]>("/api/development-plans");
    // Fetch full plans with items
    const full = await Promise.all(
      data.map((p) => api.get<Plan>(`/api/development-plans/${p.id}`))
    );
    setPlans(full);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (planId: string, item: Item) => {
    const next = item.status === "completed" ? "open" : "completed";
    try {
      await api.put(`/api/development-plans/${planId}/items/${item.id}`, { status: next });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div>
      <PageHeader title="My Development Plans" subtitle="Plans your supervisor created to help you grow." />
      {plans.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No development plans yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center"><Sprout className="size-5" /></div>
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      {p.summary && <p className="text-sm text-muted-foreground mt-1">{p.summary}</p>}
                      {p.targetDate && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="size-3" /> Target: {new Date(p.targetDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-4 space-y-2">
                  {p.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <Checkbox checked={it.status === "completed"} onCheckedChange={() => toggle(p.id, it)} />
                      <div className="flex-1">
                        <div className={`text-sm ${it.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{it.action}</div>
                        {it.dueDate && <div className="text-xs text-muted-foreground">Due {new Date(it.dueDate).toLocaleDateString()}</div>}
                      </div>
                      <StatusBadge status={it.status} />
                    </div>
                  ))}
                  {p.items.length === 0 && <div className="text-sm text-muted-foreground">No action items.</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
