import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/job-titles")({
  ssr: false,
  component: JobTitlesPage,
});

interface JobTitle { id: string; name: string; description: string | null }

function JobTitlesPage() {
  const [rows, setRows] = useState<JobTitle[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    try {
      const data = await api.get<JobTitle[]>("/api/job-titles");
      setRows(data);
    } catch (e: any) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error("Name required");
    try {
      await api.post("/api/job-titles", { name: name.trim(), description: description.trim() || null });
      toast.success("Job title created");
      setName(""); setDescription(""); setOpen(false); load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job title? Associated competencies will also be removed.")) return;
    try {
      await api.delete(`/api/job-titles/${id}`);
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div>
      <PageHeader
        title="Job Titles"
        subtitle="Create the roles employees can be assigned to."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:opacity-90"><Plus className="size-4 mr-1" /> New job title</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New job title</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <Button onClick={create} className="bg-accent text-accent-foreground w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center"><Briefcase className="size-5" /></div>
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    {r.description && <div className="text-sm text-muted-foreground mt-0.5">{r.description}</div>}
                  </div>
                </div>
                <button onClick={() => remove(r.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="size-4" /></button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No job titles yet.</div>}
      </div>
    </div>
  );
}
