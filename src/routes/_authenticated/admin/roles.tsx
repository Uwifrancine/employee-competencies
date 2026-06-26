import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setUserRoles } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  ssr: false,
  component: RolesPage,
});

type Role = "admin" | "hr" | "employee";
interface Row { id: string; full_name: string; email: string; roles: Role[] }

const ALL_ROLES: Role[] = ["admin", "hr", "employee"];

function RolesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Record<string, Role[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const save = useServerFn(setUserRoles);

  const load = async () => {
    const [{ data: profs }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").order("full_name"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const map = new Map<string, Role[]>();
    for (const r of (roleRows ?? []) as { user_id: string; role: Role }[]) {
      const list = map.get(r.user_id) ?? [];
      list.push(r.role);
      map.set(r.user_id, list);
    }
    const built: Row[] = ((profs ?? []) as any[]).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      roles: map.get(p.id) ?? ["employee"],
    }));
    setRows(built);
    setPending(Object.fromEntries(built.map((r) => [r.id, [...r.roles]])));
  };
  useEffect(() => { load(); }, []);

  const toggle = (uid: string, role: Role, checked: boolean) => {
    setPending((prev) => {
      const cur = new Set(prev[uid] ?? []);
      if (checked) cur.add(role); else cur.delete(role);
      return { ...prev, [uid]: Array.from(cur) as Role[] };
    });
  };

  const commit = async (uid: string) => {
    const next = pending[uid] ?? [];
    if (next.length === 0) return toast.error("Pick at least one role");
    setSaving(uid);
    try {
      await save({ data: { userId: uid, roles: next } });
      toast.success("Roles updated");
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
        subtitle="Grant admin, HR, or employee access. Supervisor is automatic when an employee has direct reports."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                {ALL_ROLES.map((r) => (
                  <TableHead key={r} className="text-center capitalize">{r}</TableHead>
                ))}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sel = new Set(pending[row.id] ?? []);
                const dirty = JSON.stringify([...sel].sort()) !== JSON.stringify([...row.roles].sort());
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Shield className="size-4 text-muted-foreground" /> {row.full_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    {ALL_ROLES.map((r) => (
                      <TableCell key={r} className="text-center">
                        <Checkbox
                          checked={sel.has(r)}
                          onCheckedChange={(c) => toggle(row.id, r, !!c)}
                        />
                      </TableCell>
                    ))}
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
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
