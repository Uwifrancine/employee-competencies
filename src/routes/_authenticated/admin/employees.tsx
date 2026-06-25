import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { inviteEmployee, resetEmployeePassword } from "@/lib/admin.functions";
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

interface Row {
  id: string; full_name: string; email: string;
  job_title_id: string | null; supervisor_id: string | null;
}
interface JT { id: string; name: string }

function EmployeesPage() {
  const invite = useServerFn(inviteEmployee);
  const reset = useServerFn(resetEmployeePassword);
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [jobTitles, setJobTitles] = useState<JT[]>([]);
  const [open, setOpen] = useState(false);
  const [showCred, setShowCred] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [form, setForm] = useState({
    email: "", fullName: "", role: "employee" as "admin" | "employee",
    jobTitleId: "" as string, supervisorId: "" as string,
  });

  const load = async () => {
    const [{ data: p }, { data: r }, { data: jt }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,job_title_id,supervisor_id").order("full_name"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("job_titles").select("id,name").order("name"),
    ]);
    setRows((p ?? []) as Row[]);
    const map: Record<string, string[]> = {};
    for (const row of (r ?? []) as { user_id: string; role: string }[]) {
      (map[row.user_id] ||= []).push(row.role);
    }
    setRoles(map);
    setJobTitles((jt ?? []) as JT[]);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.email || !form.fullName) return toast.error("Email and name required");
    try {
      const res = await invite({
        data: {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          jobTitleId: form.jobTitleId || null,
          supervisorId: form.supervisorId || null,
        },
      });
      setShowCred({ email: form.email, password: res.tempPassword, emailSent: res.emailSent });
      setOpen(false);
      setForm({ email: "", fullName: "", role: "employee", jobTitleId: "", supervisorId: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const doReset = async (id: string, email: string) => {
    if (!confirm(`Reset password for ${email}?`)) return;
    try {
      const r = await reset({ data: { userId: id } });
      setShowCred({ email, password: r.tempPassword, emailSent: false });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const updateField = async (id: string, field: "job_title_id" | "supervisor_id", value: string | null) => {
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const supervisorName = (id: string | null) => rows.find((r) => r.id === id)?.full_name ?? "—";
  const jobTitleName = (id: string | null) => jobTitles.find((j) => j.id === id)?.name ?? "—";

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
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
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
                      {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
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
            <TableHead>Job title</TableHead><TableHead>Supervisor</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>{(roles[r.id] ?? []).join(", ") || "employee"}</TableCell>
                <TableCell>
                  <Select value={r.job_title_id ?? "none"} onValueChange={(v) => updateField(r.id, "job_title_id", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue>{jobTitleName(r.job_title_id)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r.supervisor_id ?? "none"} onValueChange={(v) => updateField(r.id, "supervisor_id", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue>{supervisorName(r.supervisor_id)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {rows.filter((s) => s.id !== r.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => doReset(r.id, r.email)}>
                    <KeyRound className="size-4 mr-1" /> Reset pwd
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
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
              <p className={`text-xs ${showCred.emailSent ? "text-success" : "text-warning-foreground"}`}>
                {showCred.emailSent ? "Email queued for delivery." : "Email not sent — configure an email domain to enable automatic delivery."}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
