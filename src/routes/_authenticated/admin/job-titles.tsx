import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/job-titles")({
  ssr: false,
  component: JobTitlesPage,
});

interface JobTitle { id: string; name: string; description: string | null }

function JobTitlesPage() {
  const [rows, setRows] = useState<JobTitle[]>([]);

  const load = async () => {
    try {
      const data = await api.get<JobTitle[]>("/api/job-titles");
      setRows(data);
    } catch (e: any) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Job Titles"
        subtitle="View all job titles. To create or manage job titles, go to HR → Job Titles."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center flex-shrink-0"><Briefcase className="size-5" /></div>
                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                  {r.description && <div className="text-sm text-muted-foreground mt-0.5">{r.description}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No job titles yet.</div>}
      </div>
    </div>
  );
}
