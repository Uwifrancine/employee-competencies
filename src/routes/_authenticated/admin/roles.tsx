import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  ssr: false,
  component: RolesPage,
});

type Role = "admin" | "hr" | "employee";
interface Row { id: string; fullName: string; email: string; roles: { role: Role }[] }

const ALL_ROLES: Role[] = ["admin", "hr", "employee"];

function RolesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Record<string, Role>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const data = await api.get<Row[]>("/api/employees");
    setRows(data);
    setPending(
      Object.fromEntries(data.map((r) => [r.id, r.roles[0]?.role ?? "employee"]))
    );
  };
  useEffect(() => { load(); }, []);

  const updateRole = (uid: string, role: Role) => {
    setPending((prev) => ({ ...prev, [uid]: role }));
  };

  const commit = async (uid: string) => {
    const nextRole = pending[uid];
    if (!nextRole) return toast.error("Select a role");
    setSaving(uid);
    try {
      await api.put(`/api/employees/${uid}`, { roles: [nextRole] });
      toast.success("Role updated");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Role Management"
        subtitle="Assign one role per employee: Admin, HR, or Employee. Supervisor role is automatic for employees with direct reports."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Current Role</TableHead>
                <TableHead>Select Role</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const currentRole = row.roles[0]?.role ?? "employee";
                const pendingRole = pending[row.id] ?? currentRole;
                const dirty = pendingRole !== currentRole;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Shield className="size-4 text-muted-foreground" /> {row.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block px-2 py-1 rounded bg-muted text-sm capitalize">
                        {currentRole}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RadioGroup value={pendingRole} onValueChange={(v) => updateRole(row.id, v as Role)}>
                        <div className="flex items-center gap-4">
                          {ALL_ROLES.map((r) => (
                            <div key={r} className="flex items-center gap-2">
                              <RadioGroupItem value={r} id={`${row.id}-${r}`} />
                              <Label htmlFor={`${row.id}-${r}`} className="capitalize cursor-pointer">{r}</Label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={!dirty || saving === row.id}
                        onClick={() => commit(row.id)}
                        className="bg-accent text-accent-foreground"
                      >
                        {saving === row.id ? "Saving…" : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
