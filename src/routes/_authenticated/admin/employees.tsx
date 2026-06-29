import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Copy, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  ssr: false,
  component: EmployeesPage,
});

interface Employee {
  id: string;
  fullName: string;
  email: string;
  mustChangePassword: boolean;
  isActive: boolean;
  jobTitle: { id: string; name: string } | null;
  supervisor: { id: string; fullName: string } | null;
  roles: { role: string }[];
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + "!9";
}

function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showCred, setShowCred] = useState<{ email: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "employee" as "admin" | "hr" | "employee",
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    role: "employee" as "admin" | "hr" | "employee",
  });

  const load = async () => {
    const emps = await api.get<Employee[]>("/api/employees");
    setRows(emps);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.email || !form.fullName) return toast.error("Email and name required");
    const tempPassword = form.password || generateTempPassword();
    try {
      await api.post("/api/auth/register", {
        email: form.email,
        password: tempPassword,
        fullName: form.fullName,
        roles: [form.role],
      });
      setShowCred({ email: form.email, password: tempPassword });
      setOpen(false);
      setForm({ email: "", fullName: "", password: "", role: "employee" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const toggleStatus = async (id: string, newStatus: boolean) => {
    try {
      await api.put(`/api/employees/${id}`, { isActive: newStatus });
      toast.success(newStatus ? "Employee activated" : "Employee deactivated");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update status");
    }
  };

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setEditForm({
      fullName: employee.fullName,
      email: employee.email,
      role: (employee.roles[0]?.role as "admin" | "hr" | "employee") || "employee",
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editForm.email || !editForm.fullName) return toast.error("Email and name required");
    try {
      await api.put(`/api/employees/${editingId}`, {
        fullName: editForm.fullName,
        email: editForm.email,
        roles: [editForm.role],
      });
      toast.success("Employee updated successfully");
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update employee");
    }
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Register new employees and manage their access"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:opacity-90">
                <UserPlus className="size-4 mr-1" /> New employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Temporary password (leave blank to auto-generate)</Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as "admin" | "hr" | "employee" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-accent text-accent-foreground" onClick={submit}>
                  Create & generate temp password
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell>{r.roles.map((x) => x.role).join(", ") || "employee"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={r.isActive}
                      onCheckedChange={() => toggleStatus(r.id, !r.isActive)}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openEdit(r)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No employees yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!showCred} onOpenChange={(o) => !o && setShowCred(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
          </DialogHeader>
          {showCred && (
            <div className="space-y-3">
              <p className="text-sm">
                Share this with <span className="font-medium">{showCred.email}</span>. They'll be
                asked to change it on first sign-in.
              </p>
              <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 font-mono text-sm">
                <span className="flex-1">{showCred.password}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(showCred.password);
                    toast.success("Copied");
                  }}
                  className="text-primary"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v as "admin" | "hr" | "employee" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-accent text-accent-foreground" onClick={submitEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
