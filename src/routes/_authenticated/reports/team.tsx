import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports/team")({
  ssr: false,
  component: TeamReport,
});

interface Member {
  id: string; fullName: string;
  latestEvalScore: number | null; openDevPlans: number;
  avgQuizScore: number | null;
}

function TeamReport() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ members: Member[] }>(`/api/reports/team/${user.id}`)
      .then((r) => setMembers(r.members))
      .catch(() => {});
  }, [user?.id]);

  const cell = (v: number | null) =>
    v === null ? <span className="text-muted-foreground">—</span> :
      <span className={`font-semibold ${v >= 60 ? "text-success" : "text-destructive"}`}>{v.toFixed(0)}%</span>;

  return (
    <div>
      <PageHeader title="Team Report" subtitle="Snapshot of every direct report." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Latest eval</TableHead>
            <TableHead>Open dev plans</TableHead><TableHead>Quiz avg</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {members.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell>{cell(r.latestEvalScore)}</TableCell>
                <TableCell>{r.openDevPlans}</TableCell>
                <TableCell>{cell(r.avgQuizScore)}</TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No direct reports.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
