import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/evaluations")({
  ssr: false,
  component: EvaluationsPage,
});

interface Eval { id: string; overall_percent: number; evaluator_type: string; created_at: string }

function EvaluationsPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Eval[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("evaluations").select("id,overall_percent,evaluator_type,created_at")
      .eq("employee_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Eval[]));
  }, [user]);

  return (
    <div>
      <PageHeader
        title="My Evaluations"
        subtitle="Self-evaluations and reviews from your supervisor."
        action={
          profile?.job_title_id ? (
            <Link to="/evaluations/new">
              <Button className="bg-accent text-accent-foreground"><Plus className="size-4 mr-1" /> New self-evaluation</Button>
            </Link>
          ) : null
        }
      />
      {!profile?.job_title_id && (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-muted-foreground">
          You need a job title assigned before you can self-evaluate. Ask your admin.
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Overall</TableHead><TableHead>Result</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="capitalize">{r.evaluator_type}</TableCell>
                <TableCell className="font-medium">{Number(r.overall_percent).toFixed(1)}%</TableCell>
                <TableCell><StatusBadge status={Number(r.overall_percent) >= 60 ? "pass" : "fail"} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No evaluations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
