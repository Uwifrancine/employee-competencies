import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/competencies")({
  ssr: false,
  component: CompetenciesPage,
});

interface JT { id: string; name: string }
interface Comp { id: string; name: string; description: string | null; jobTitleId: string }

function CompetenciesPage() {
  const [jts, setJts] = useState<JT[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [comps, setComps] = useState<Comp[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    api.get<JT[]>("/api/job-titles").then((list) => {
      setJts(list);
      if (list[0] && !selected) setSelected(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) { setComps([]); return; }
    api.get<Comp[]>(`/api/competencies?jobTitleId=${selected}`).then(setComps);
  }, [selected]);

  const reload = () =>
    api.get<Comp[]>(`/api/competencies?jobTitleId=${selected}`).then(setComps);

  const add = async () => {
    if (!selected) return toast.error("Pick a job title first");
    if (!name.trim()) return toast.error("Name required");
    try {
      await api.post("/api/competencies", {
        jobTitleId: selected, name: name.trim(), description: desc.trim() || null,
      });
      setName(""); setDesc(""); reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this competency?")) return;
    try {
      await api.delete(`/api/competencies/${id}`);
      reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div>
      <PageHeader title="Competencies" subtitle="Define the competencies expected for each job title." />

      {jts.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Create a job title first.</CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Job title</div>
              {jts.map((j) => (
                <button key={j.id} onClick={() => setSelected(j.id)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm ${selected === j.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {j.name}
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card><CardContent className="p-5 space-y-3">
              <div className="text-sm font-medium">Add competency</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Communication" /></div>
                <div className="sm:col-span-2"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" /></div>
              </div>
              <Button onClick={add} className="bg-accent text-accent-foreground"><Plus className="size-4 mr-1" /> Add</Button>
            </CardContent></Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {comps.map((c) => (
                <Card key={c.id}><CardContent className="p-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-md bg-secondary text-secondary-foreground grid place-items-center"><Target className="size-4" /></div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.description && <div className="text-sm text-muted-foreground mt-0.5">{c.description}</div>}
                    </div>
                  </div>
                  <button onClick={() => remove(c.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="size-4" /></button>
                </CardContent></Card>
              ))}
              {comps.length === 0 && <div className="text-sm text-muted-foreground">No competencies for this job title.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
