import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sprout, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/development-plans")({
  ssr: false,
  component: PlansPage,
});

interface Plan {
  id: string; title: string; summary: string | null; status: string; target_date: string | null; created_at: string;
}
interface Item { id: string; plan_id: string; action: string; due_date: string | null; status: string }

function PlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("development_plans")
      .select("id,title,summary,status,target_date,created_at")
      .eq("employee_id", user.id).order("created_at", { ascending: false });
    setPlans((p ?? []) as Plan[]);
    const ids = (p ?? []).map((x: any) => x.id);
    if (ids.length) {
      const { data: it } = await supabase.from("dev_plan_items").select("*").in("plan_id", ids);
      setItems((it ?? []) as Item[]);
    } else setItems([]);
  };
  useEffect(() => { load(); }, [user]);

  const toggle = async (it: Item) => {
    const next = it.status === "completed" ? "open" : "completed";
    const { error } = await supabase.from("dev_plan_items").update({ status: next as any }).eq("id", it.id);
    if (error) return toast.error(error.message);
    load();
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
                      {p.target_date && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="size-3" /> Target: {new Date(p.target_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-4 space-y-2">
                  {items.filter((i) => i.plan_id === p.id).map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <Checkbox checked={it.status === "completed"} onCheckedChange={() => toggle(it)} />
                      <div className="flex-1">
                        <div className={`text-sm ${it.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{it.action}</div>
                        {it.due_date && <div className="text-xs text-muted-foreground">Due {new Date(it.due_date).toLocaleDateString()}</div>}
                      </div>
                      <StatusBadge status={it.status} />
                    </div>
                  ))}
                  {items.filter((i) => i.plan_id === p.id).length === 0 && (
                    <div className="text-sm text-muted-foreground">No action items.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
