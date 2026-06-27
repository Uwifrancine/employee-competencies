import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees")({
  ssr: false,
  component: HrEmployeesPage,
});

interface Employee {
  id: string; fullName: string; email: string;
  jobTitle: { id: string; name: string } | null;
  supervisor: { id: string; fullName: string } | null;
}
interface JT { id: string; name: string }

function HrEmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [jobTitles, setJobTitles] = useState<JT[]>([]);

  const load = async () => {
    const [emps, jts] = await Promise.all([
      api.get<Employee[]>("/api/employees"),
      api.get<JT[]>("/api/job-titles"),
    ]);
    setRows(emps);
    setJobTitles(jts);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, field: "jobTitleId" | "supervisorId", value: string | null) => {
    try {
      await api.put(`/api/employees/${id}`, { [field]: value });
      toast.success("Updated");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

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
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <Select value={r.jobTitle?.id ?? "none"} onValueChange={(v) => update(r.id, "jobTitleId", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue>{r.jobTitle?.name ?? "—"}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r.supervisor?.id ?? "none"} onValueChange={(v) => update(r.id, "supervisorId", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue>{r.supervisor?.fullName ?? "—"}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {rows.filter((s) => s.id !== r.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
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
