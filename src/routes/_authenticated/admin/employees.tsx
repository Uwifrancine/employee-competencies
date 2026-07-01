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
import { UserPlus, Copy, Pencil, Lock } from "lucide-react";

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
  const [resetOpen, setResetOpen] = useState(false);
  const [showCred, setShowCred] = useState<{ email: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string>("");
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "employee" as "admin" | "hr" | "employee",
  });
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    fullName?: string;
    password?: string;
  }>({});
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    role: "employee" as "admin" | "hr" | "employee",
  });
  const [editErrors, setEditErrors] = useState<{
    email?: string;
    fullName?: string;
  }>({});

  const load = async () => {
    const emps = await api.get<Employee[]>("/api/employees");
    setRows(emps);
  };
  useEffect(() => {
    load();
  }, []);

  const validateCreateForm = () => {
    const errors: typeof formErrors = {};

    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required";
    } else if (form.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (form.password.trim() && form.password.length < 6) {
      errors.password = "Password must be at least 6 characters (or leave blank to auto-generate)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (!validateCreateForm()) return;

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
      setFormErrors({});
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create employee");
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

  const validateEditForm = () => {
    const errors: typeof editErrors = {};

    if (!editForm.fullName.trim()) {
      errors.fullName = "Full name is required";
    } else if (editForm.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters";
    }

    if (!editForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitEdit = async () => {
    if (!validateEditForm()) return;

    try {
      await api.put(`/api/employees/${editingId}`, {
        fullName: editForm.fullName,
        email: editForm.email,
        roles: [editForm.role],
      });
      toast.success("Employee updated successfully");
      setEditOpen(false);
      setEditErrors({});
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update employee");
    }
  };

  const openResetPassword = (employee: Employee) => {
    setResettingId(employee.id);
    setResetPassword("");
    setResetError("");
    setResetOpen(true);
  };

  const submitResetPassword = async () => {
    if (!resetPassword.trim()) {
      setResetError("Password is required");
      return;
    }
    if (resetPassword.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }

    try {
      await api.put(`/api/employees/${resettingId}/reset-password`, {
        password: resetPassword,
      });

      const employee = rows.find((r) => r.id === resettingId);
      setShowCred({
        email: employee?.email || "",
        password: resetPassword,
      });

      toast.success("Password reset successfully");
      setResetOpen(false);
      setResetPassword("");
      setResetError("");
      setResettingId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset password");
    }
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Register new employees and manage their access"
        action={
          <Dialog
            open={open}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setFormErrors({});
                setForm({ email: "", fullName: "", password: "", role: "employee" });
              }
              setOpen(isOpen);
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:opacity-90">
                <UserPlus className="size-4 mr-1" /> New employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className={formErrors.fullName ? "text-destructive" : ""}>Full name</Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => {
                      setForm({ ...form, fullName: e.target.value });
                      if (formErrors.fullName) {
                        setFormErrors({ ...formErrors, fullName: undefined });
                      }
                    }}
                    className={`${
                      formErrors.fullName ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {formErrors.fullName && (
                    <p className="text-xs text-destructive mt-1">{formErrors.fullName}</p>
                  )}
                </div>
                <div>
                  <Label className={formErrors.email ? "text-destructive" : ""}>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      if (formErrors.email) {
                        setFormErrors({ ...formErrors, email: undefined });
                      }
                    }}
                    className={`${
                      formErrors.email ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive mt-1">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <Label className={formErrors.password ? "text-destructive" : ""}>
                    Temporary password (leave blank to auto-generate)
                  </Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      if (formErrors.password) {
                        setFormErrors({ ...formErrors, password: undefined });
                      }
                    }}
                    className={`${
                      formErrors.password ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {formErrors.password && (
                    <p className="text-xs text-destructive mt-1">{formErrors.password}</p>
                  )}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit employee"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => openResetPassword(r)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Reset password"
                      >
                        <Lock className="size-4" />
                      </button>
                    </div>
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

      <Dialog
        open={editOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditErrors({});
            setEditingId(null);
          }
          setEditOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className={editErrors.fullName ? "text-destructive" : ""}>Full name</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => {
                  setEditForm({ ...editForm, fullName: e.target.value });
                  if (editErrors.fullName) {
                    setEditErrors({ ...editErrors, fullName: undefined });
                  }
                }}
                className={`${
                  editErrors.fullName ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {editErrors.fullName && (
                <p className="text-xs text-destructive mt-1">{editErrors.fullName}</p>
              )}
            </div>
            <div>
              <Label className={editErrors.email ? "text-destructive" : ""}>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => {
                  setEditForm({ ...editForm, email: e.target.value });
                  if (editErrors.email) {
                    setEditErrors({ ...editErrors, email: undefined });
                  }
                }}
                className={`${
                  editErrors.email ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {editErrors.email && (
                <p className="text-xs text-destructive mt-1">{editErrors.email}</p>
              )}
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

      <Dialog
        open={resetOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setResetPassword("");
            setResetError("");
            setResettingId(null);
          }
          setResetOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Employee Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {resettingId && (
              <div className="bg-muted/50 p-3 rounded-md border border-border">
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  Enter a new temporary password for{" "}
                  <span className="font-semibold text-accent">
                    {rows.find((r) => r.id === resettingId)?.fullName}
                  </span>
                  . They'll be asked to change it on their next sign-in.
                </p>
              </div>
            )}
            <div>
              <Label className={resetError ? "text-destructive" : ""}>New Password</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => {
                  setResetPassword(e.target.value);
                  if (resetError) setResetError("");
                }}
                placeholder="Enter temporary password (min. 6 characters)"
                className={`${resetError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {resetError && <p className="text-xs text-destructive mt-1">{resetError}</p>}
            </div>
            <Button
              className="w-full bg-accent text-accent-foreground"
              onClick={submitResetPassword}
            >
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
