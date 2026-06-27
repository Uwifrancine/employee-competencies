import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { KeyRound, UserPlus, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  ssr: false,
  component: EmployeesPage,
});

interface Employee {
  id: string; fullName: string; email: string; mustChangePassword: boolean;
  jobTitle: { id: string; name: string } | null;
  supervisor: { id: string; fullName: string } | null;
  roles: { role: string }[];
}
interface JT { id: string; name: string }

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + "!9";
}

function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [jobTitles, setJobTitles] = useState<JT[]>([]);
  const [open, setOpen] = useState(false);
  const [showCred, setShowCred] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({
    email: "", fullName: "", password: "", role: "employee" as "admin" | "hr" | "employee",
    jobTitleId: "", supervisorId: "",
  });

  const load = async () => {
    const [emps, jts] = await Promise.all([
      api.get<Employee[]>("/api/employees"),
      api.get<JT[]>("/api/job-titles"),
    ]);
    setRows(emps);
    setJobTitles(jts);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.email || !form.fullName) return toast.error("Email and name required");
    const tempPassword = form.password || generateTempPassword();
    try {
      await api.post("/api/auth/register", {
        email: form.email,
        password: tempPassword,
        fullName: form.fullName,
        roles: [form.role],
        jobTitleId: form.jobTitleId || undefined,
        supervisorId: form.supervisorId || undefined,
      });
      setShowCred({ email: form.email, password: tempPassword });
      setOpen(false);
      setForm({ email: "", fullName: "", password: "", role: "employee", jobTitleId: "", supervisorId: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const updateField = async (id: string, field: "jobTitleId" | "supervisorId", value: string | null) => {
    try {
      await api.put(`/api/employees/${id}`, { [field]: value });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const supervisorName = (sup: Employee["supervisor"]) => sup?.fullName ?? "—";
  const jobTitleName = (jt: Employee["jobTitle"]) => jt?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Register employees and assign their job title and supervisor."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:opacity-90"><UserPlus className="size-4 mr-1" /> New employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register employee</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Full name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Temporary password (leave blank to auto-generate)</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Job title</Label>
                  <Select value={form.jobTitleId || "none"} onValueChange={(v) => setForm({ ...form, jobTitleId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supervisor</Label>
                  <Select value={form.supervisorId || "none"} onValueChange={(v) => setForm({ ...form, supervisorId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-accent text-accent-foreground" onClick={submit}>Create & generate temp password</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
            <TableHead>Job title</TableHead><TableHead>Supervisor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>{r.roles.map((x) => x.role).join(", ") || "employee"}</TableCell>
                <TableCell>
                  <Select value={r.jobTitle?.id ?? "none"} onValueChange={(v) => updateField(r.id, "jobTitleId", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue>{jobTitleName(r.jobTitle)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r.supervisor?.id ?? "none"} onValueChange={(v) => updateField(r.id, "supervisorId", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue>{supervisorName(r.supervisor)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {rows.filter((s) => s.id !== r.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!showCred} onOpenChange={(o) => !o && setShowCred(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Temporary password</DialogTitle></DialogHeader>
          {showCred && (
            <div className="space-y-3">
              <p className="text-sm">Share this with <span className="font-medium">{showCred.email}</span>. They'll be asked to change it on first sign-in.</p>
              <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 font-mono text-sm">
                <span className="flex-1">{showCred.password}</span>
                <button onClick={() => { navigator.clipboard.writeText(showCred.password); toast.success("Copied"); }} className="text-primary"><Copy className="size-4" /></button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
