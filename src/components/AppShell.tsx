import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { clearToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Target,
  ClipboardCheck,
  UserCheck,
  Sprout,
  LogOut,
  Menu,
  Shield,
  BookOpen,
  BarChart3,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const sections: NavSection[] = [
    {
      label: "Me",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/my-competencies", label: "My Competencies", icon: BookOpen },
        { to: "/evaluations", label: "My Evaluations", icon: ClipboardCheck },
        { to: "/my-quizzes", label: "My Quizzes", icon: HelpCircle },
        { to: "/development-plans", label: "My Development Plan", icon: Sprout },
        { to: "/reports/individual", label: "My Report", icon: BarChart3 },
      ],
    },
  ];

  if (auth.isSupervisor) {
    sections.push({
      label: "Supervisor",
      items: [
        { to: "/supervisor", label: "My Team", icon: UserCheck },
        { to: "/supervisor/quizzes", label: "Quizzes", icon: GraduationCap },
        { to: "/reports/team", label: "Team Report", icon: BarChart3 },
      ],
    });
  }

  if (auth.isHR) {
    sections.push({
      label: "HR",
      items: [
        { to: "/hr/employees", label: "Employees", icon: Users },
        { to: "/admin/job-titles", label: "Job Titles", icon: Briefcase },
        { to: "/admin/competencies", label: "Competencies", icon: Target },
        { to: "/reports/org", label: "Org Report", icon: BarChart3 },
      ],
    });
  }

  if (auth.isAdmin) {
    sections.push({
      label: "Admin",
      items: [
        { to: "/admin/employees", label: "Employees", icon: Users },
        { to: "/admin/roles", label: "Roles", icon: Shield },
        { to: "/admin/job-titles", label: "Job Titles", icon: Briefcase },
        { to: "/admin/competencies", label: "Competencies", icon: Target },
        { to: "/reports/org", label: "Org Report", icon: BarChart3 },
      ],
    });
  }

  const onLogout = () => {
    clearToken();
    navigate({ to: "/auth", replace: true });
  };

  if (auth.loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  if (auth.profile?.must_change_password && pathname !== "/change-password") {
    navigate({ to: "/change-password" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <button onClick={() => setOpen((v) => !v)} className="p-1"><Menu className="size-5" /></button>
        <div className="font-semibold">Competency Manager</div>
        <button onClick={onLogout}><LogOut className="size-5" /></button>
      </div>

      <div className="md:grid md:grid-cols-[260px_1fr]">
        <aside className={`${open ? "block" : "hidden"} md:block bg-sidebar text-sidebar-foreground md:min-h-screen`}>
          <div className="hidden md:block p-6">
            <div className="text-lg font-bold">Competency Manager</div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">{auth.profile?.full_name}</div>
            <div className="text-[10px] uppercase tracking-wide text-accent mt-1">{auth.primaryRoleLabel}</div>
          </div>
          <nav className="p-3 space-y-4">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-3 pb-1 text-[10px] uppercase tracking-wide text-sidebar-foreground/60">{section.label}</div>
                <div className="space-y-1">
                  {section.items.map((i) => {
                    const active = pathname === i.to || pathname.startsWith(i.to + "/");
                    return (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "hover:bg-sidebar-accent"
                        }`}
                      >
                        <i.icon className="size-4" />
                        {i.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="hidden md:block p-3 mt-auto">
            <Button onClick={onLogout} variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="size-4 mr-2" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-warning text-warning-foreground",
    in_progress: "bg-accent text-accent-foreground",
    completed: "bg-success text-success-foreground",
    pass: "bg-success text-success-foreground",
    fail: "bg-destructive text-destructive-foreground",
    pending: "bg-warning text-warning-foreground",
    submitted: "bg-success text-success-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
