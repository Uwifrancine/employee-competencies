import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EvaluationDialog } from "@/components/EvaluationDialog";
import { Target, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-competencies")({
  ssr: false,
  component: MyCompetencies,
});

interface Comp { id: string; name: string; description: string | null }

function MyCompetencies() {
  const { profile, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comps, setComps] = useState<Comp[]>([]);
  const [jobTitleName, setJobTitleName] = useState<string | null>(null);
  const [compsLoading, setCompsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (!profile.job_title_id) {
        setCompsLoading(false);
        return;
      }
      try {
        const [jt, cs] = await Promise.all([
          api.get<{ id: string; name: string; competencies: Comp[] }>(`/api/job-titles/${profile.job_title_id}`),
          api.get<Comp[]>(`/api/competencies?jobTitleId=${profile.job_title_id}`),
        ]);
        setJobTitleName(jt.name);
        setComps(cs);
      } catch (e) {
        console.error("Failed to load competencies:", e);
      }
      setCompsLoading(false);
    })();
  }, [profile]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="My Competencies"
          subtitle="Competencies expected for your job title."
        />
        <Card><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Competencies"
        subtitle={jobTitleName ? `Expected for ${jobTitleName}` : "Competencies expected for your job title."}
        action={
          comps.length > 0 && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-accent-foreground"
            >
              <ClipboardCheck className="size-4 mr-1" /> Self-evaluate
            </Button>
          )
        }
      />
      {!profile?.job_title_id ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          You don't have a job title assigned yet. Please ask HR or your admin to assign one.
        </CardContent></Card>
      ) : compsLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
      ) : comps.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          No competencies have been defined for your job title yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {comps.map((c) => (
            <Card key={c.id}><CardContent className="p-4 flex items-start gap-3">
              <div className="size-9 rounded-md bg-secondary text-secondary-foreground grid place-items-center">
                <Target className="size-4" />
              </div>
              <div>
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-sm text-muted-foreground mt-0.5">{c.description}</div>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
      <EvaluationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
