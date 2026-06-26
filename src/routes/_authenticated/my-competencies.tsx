import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-competencies")({
  ssr: false,
  component: MyCompetencies,
});

interface Comp { id: string; name: string; description: string | null }

function MyCompetencies() {
  const { profile } = useAuth();
  const [comps, setComps] = useState<Comp[]>([]);
  const [jobTitleName, setJobTitleName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (!profile.job_title_id) { setLoaded(true); return; }
      const [{ data: jt }, { data: c }] = await Promise.all([
        supabase.from("job_titles").select("name").eq("id", profile.job_title_id).maybeSingle(),
        supabase.from("competencies").select("id,name,description").eq("job_title_id", profile.job_title_id).order("name"),
      ]);
      setJobTitleName((jt as any)?.name ?? null);
      setComps((c ?? []) as Comp[]);
      setLoaded(true);
    })();
  }, [profile]);

  if (!loaded) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="My Competencies"
        subtitle={jobTitleName ? `Expected for ${jobTitleName}` : "Competencies expected for your job title."}
        action={
          comps.length > 0 && (
            <Link to="/evaluations/new">
              <Button className="bg-accent text-accent-foreground">
                <ClipboardCheck className="size-4 mr-1" /> Self-evaluate
              </Button>
            </Link>
          )
        }
      />
      {!profile?.job_title_id ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          You don't have a job title assigned yet. Please ask HR or your admin to assign one.
        </CardContent></Card>
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
    </div>
  );
}
