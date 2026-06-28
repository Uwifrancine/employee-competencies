import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EvaluationDialog } from "@/components/EvaluationDialog";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/evaluations")({
  ssr: false,
  component: EvaluationsPage,
});

interface Eval { id: string; overallPercent: number; evaluatorType: string; createdAt: string }

function EvaluationsPage() {
  const { profile, loading } = useAuth();
  const [rows, setRows] = useState<Eval[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    console.log("EvaluationsPage - profile loaded:", profile?.id);
    if (!profile?.id) {
      console.log("EvaluationsPage - no profile, skipping fetch");
      setRowsLoading(false);
      return;
    }
    console.log("EvaluationsPage - fetching evaluations");
    setRowsLoading(true);
    api
      .get<Eval[]>("/api/evaluations")
      .then((data) => {
        console.log("EvaluationsPage - got evaluations:", data);
        setRows(data);
      })
      .catch((err) => {
        console.error("EvaluationsPage - error fetching evaluations:", err);
        setRows([]);
      })
      .finally(() => {
        console.log("EvaluationsPage - finished loading evaluations");
        setRowsLoading(false);
      });
  }, [profile?.id]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="My Evaluations"
          subtitle="Self-evaluations and reviews from your supervisor."
        />
        <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Evaluations"
        subtitle="Self-evaluations and reviews from your supervisor."
        action={
          profile?.job_title_id ? (
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-accent-foreground"
            >
              <Plus className="size-4 mr-1" /> New self-evaluation
            </Button>
          ) : null
        }
      />

      {!profile?.job_title_id ? (
        <Card className="mb-4 border-warning">
          <CardContent className="p-5 space-y-1">
            <div className="font-medium">No job title assigned</div>
            <p className="text-sm text-muted-foreground">
              You need a job title before you can self-evaluate. Ask your HR or admin to assign one from the <strong>Employees</strong> page.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {profile?.job_title_id && rowsLoading && (
        <Card className="mb-4">
          <CardContent className="p-5"><Skeleton className="h-20" /></CardContent>
        </Card>
      )}

      {profile?.job_title_id && !rowsLoading && rows.length === 0 && (
        <Card className="mb-4">
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="font-medium">No evaluations yet</div>
            <p className="text-sm text-muted-foreground">
              Rate yourself on each competency from 1 (needs improvement) to 5 (excellent). Add optional comments, then submit.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-accent-foreground"
            >
              <Plus className="size-4 mr-1" /> Start your first self-evaluation
            </Button>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-4">
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-accent-foreground"
            >
              <Plus className="size-4 mr-1" /> Create Another Evaluation
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Overall</TableHead><TableHead>Result</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{r.evaluatorType}</TableCell>
                    <TableCell className="font-medium">{Number(r.overallPercent).toFixed(1)}%</TableCell>
                    <TableCell><StatusBadge status={Number(r.overallPercent) >= 60 ? "pass" : "fail"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </>
      )}

      <EvaluationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setRowsLoading(true);
          api
            .get<Eval[]>("/api/evaluations")
            .then(setRows)
            .catch(() => setRows([]))
            .finally(() => setRowsLoading(false));
        }}
      />
    </div>
  );
}
