import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

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

  return (
    <div>
      <PageHeader
        title="Competencies"
        subtitle="View competencies for each job title. To create or manage competencies, go to HR → Competencies."
      />

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
            <div className="grid gap-3 sm:grid-cols-2">
              {comps.map((c) => (
                <Card key={c.id}><CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-md bg-secondary text-secondary-foreground grid place-items-center flex-shrink-0"><Target className="size-4" /></div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.description && <div className="text-sm text-muted-foreground mt-0.5">{c.description}</div>}
                    </div>
                  </div>
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
