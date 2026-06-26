import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees")({
  ssr: false,
  component: HrEmployeesPage,
});

interface Row {
  id: string; full_name: string; email: string;
  job_title_id: string | null; supervisor_id: string | null;
}
interface JT { id: string; name: string }

function HrEmployeesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [jobTitles, setJobTitles] = useState<JT[]>([]);

  const load = async () => {
    const [{ data: p }, { data: jt }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,job_title_id,supervisor_id").order("full_name"),
      supabase.from("job_titles").select("id,name").order("name"),
    ]);
    setRows((p ?? []) as Row[]);
    setJobTitles((jt ?? []) as JT[]);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, field: "job_title_id" | "supervisor_id", value: string | null) => {
    const { error } = await supabase.from("profiles").update({ [field]: value } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  const jtName = (id: string | null) => jobTitles.find((j) => j.id === id)?.name ?? "—";
  const supName = (id: string | null) => rows.find((r) => r.id === id)?.full_name ?? "—";

  return (
    <div>
      <PageHeader
        title="Employees (HR)"
        subtitle="Assign job titles and supervisors. Use Admin → Employees to register new people."
      />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead>
            <TableHead>Job title</TableHead><TableHead>Supervisor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <Select value={r.job_title_id ?? "none"} onValueChange={(v) => update(r.id, "job_title_id", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue>{jtName(r.job_title_id)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r.supervisor_id ?? "none"} onValueChange={(v) => update(r.id, "supervisor_id", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue>{supName(r.supervisor_id)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {rows.filter((s) => s.id !== r.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
