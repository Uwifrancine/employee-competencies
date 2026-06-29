import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees")({
  ssr: false,
  component: HrEmployeesPage,
});

interface Employee {
  id: string;
  fullName: string;
  email: string;
  jobTitle: { id: string; name: string } | null;
  supervisor: { id: string; fullName: string } | null;
  roles: { role: string }[];
}
interface JT {
  id: string;
  name: string;
}

interface Pending {
  jobTitleId?: string | null;
  supervisorId?: string | null;
}

function HrEmployeesPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [jobTitles, setJobTitles] = useState<JT[]>([]);
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const [emps, jts] = await Promise.all([
      api.get<Employee[]>("/api/employees"),
      api.get<JT[]>("/api/job-titles"),
    ]);
    // Filter out current user and show only employees (not admin or hr)
    const filtered = emps.filter(
      (e) => e.id !== auth.user?.id && (e.roles[0]?.role ?? "employee") === "employee"
    );
    setRows(filtered);
    setJobTitles(jts);
  };
  useEffect(() => {
    load();
  }, [auth.user?.id]);

  const updatePending = (
    id: string,
    field: "jobTitleId" | "supervisorId",
    value: string | null,
  ) => {
    setPending((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value === "none" ? null : value },
    }));
  };

  const commit = async (id: string) => {
    const changes = pending[id];
    if (!changes) return;
    setSaving(id);
    try {
      await api.put(`/api/employees/${id}`, changes);
      toast.success("Updated");
      setPending((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader title="Employees (HR)" subtitle="Assign job titles and supervisors" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const changes = pending[r.id];
                const dirty = !!changes;
                const jobTitleId =
                  changes?.jobTitleId !== undefined ? changes.jobTitleId : r.jobTitle?.id;
                const supervisorId =
                  changes?.supervisorId !== undefined ? changes.supervisorId : r.supervisor?.id;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Select
                        value={jobTitleId ?? "none"}
                        onValueChange={(v) => updatePending(r.id, "jobTitleId", v)}
                      >
                        <SelectTrigger className="h-8 w-[200px]">
                          <SelectValue>
                            {jobTitleId
                              ? (jobTitles.find((j) => j.id === jobTitleId)?.name ?? "—")
                              : "—"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— none —</SelectItem>
                          {jobTitles.map((j) => (
                            <SelectItem key={j.id} value={j.id}>
                              {j.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(r.roles[0]?.role ?? "employee") === "admin" ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <Select
                          value={supervisorId ?? "none"}
                          onValueChange={(v) => updatePending(r.id, "supervisorId", v)}
                        >
                          <SelectTrigger className="h-8 w-[200px]">
                            <SelectValue>
                              {supervisorId
                                ? (rows.find((s) => s.id === supervisorId)?.fullName ?? "—")
                                : "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— none —</SelectItem>
                            {rows
                              .filter(
                                (s) =>
                                  s.id !== r.id && (s.roles[0]?.role ?? "employee") === "employee",
                              )
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.fullName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={!dirty || saving === r.id}
                        onClick={() => commit(r.id)}
                        className="bg-accent text-accent-foreground"
                      >
                        {saving === r.id ? "Saving…" : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No employees yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
