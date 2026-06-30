import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { clearToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Target,
  ClipboardCheck,
  Sprout,
  LogOut,
  Menu,
  Shield,
  BookOpen,
  BarChart3,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";

type NavItem = { to: string; label: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Single notification poller for the whole shell (both desktop + mobile bells
  // share this state so popups never fire twice).
  const notify = useNotifications(!!auth.user);
  useEffect(() => {
    if (auth.user && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [auth.user]);

  const sections: NavSection[] = [];

  if (auth.isEmployee || auth.isSupervisor) {
    sections.push({
      label: "My Profile",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/my-competencies", label: "Competencies", icon: BookOpen },
        { to: "/evaluations", label: "Evaluations", icon: ClipboardCheck },
        { to: "/development-plans", label: "Development Plans", icon: Sprout },
        { to: "/reports/individual", label: "Performance Report", icon: BarChart3 },
      ],
    });
  }

  if (auth.isSupervisor) {
    sections.push({
      label: "Team Management",
      items: [
        { to: "/supervisor", label: "Team Overview", icon: Users },
        { to: "/supervisor/competencies", label: "Setting Competencies", icon: Target },
        { to: "/supervisor/quizzes", label: "Quiz Management", icon: GraduationCap },
        { to: "/supervisor/report", label: "Team Evaluation Report", icon: BarChart3 },
        { to: "/reports/team", label: "Team Analytics", icon: BarChart3 },
      ],
    });
  }

  if (auth.isHR) {
    sections.push({
      label: "HR",
      items: [
        { to: "/hr/employees", label: "Employees", icon: Users },
        { to: "/hr/job-titles", label: "Job Titles", icon: Briefcase },
        { to: "/hr/competencies", label: "Competencies", icon: Target },
        { to: "/hr/organization-report", label: "Organization Report", icon: BarChart3 },
        { to: "/hr/competencies-report", label: "Competencies Report", icon: BarChart3 },
      ],
    });
  }

  if (auth.isAdmin) {
    sections.push({
      label: "Admin",
      items: [
        { to: "/admin/analytics", label: "Analytics Dashboard", icon: BarChart3 },
        { to: "/admin/employees", label: "Employees", icon: Users },
        { to: "/admin/roles", label: "Roles", icon: Shield },
        { to: "/admin/job-titles", label: "Job Titles", icon: Briefcase },
        { to: "/admin/competencies", label: "Competencies", icon: Target },
        { to: "/hr/organization-report", label: "Organization Report", icon: BarChart3 },
        { to: "/admin/reports", label: "Job Titles Report", icon: BarChart3 },
        { to: "/hr/competencies-report", label: "Competencies Report", icon: BarChart3 },
      ],
    });
  }

  // Collect all known nav paths so we can detect when a more-specific path is active
  const allNavPaths = sections.flatMap((s) => s.items.map((i) => i.to));

  const isNavActive = (to: string) => {
    if (pathname === to) return true;
    if (!pathname.startsWith(to + "/")) return false;
    // Only mark parent active if no longer/more-specific nav path also matches
    const moreSpecific = allNavPaths.some(
      (other) => other !== to && other.length > to.length && pathname.startsWith(other)
    );
    return !moreSpecific;
  };

  // Accordion: track which sections are expanded. The first section ("My Profile")
  // is expanded by default, plus any section containing the active route.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      sections.forEach((section, idx) => {
        const hasActive = section.items.some((i) => isNavActive(i.to));
        if (hasActive || (idx === 0 && prev[section.label] === undefined)) {
          next[section.label] = true;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSection = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

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
        <div className="flex items-center gap-1">
          {auth.user && (
            <NotificationBell
              items={notify.items}
              unreadCount={notify.unreadCount}
              markRead={notify.markRead}
              markAllRead={notify.markAllRead}
            />
          )}
          <button onClick={onLogout}><LogOut className="size-5" /></button>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[260px_1fr]">
        <aside className={`${open ? "block" : "hidden"} md:block bg-sidebar text-sidebar-foreground md:min-h-screen`}>
          <div className="hidden md:block p-6">
            <div className="text-lg font-bold">Competency Manager</div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">{auth.profile?.full_name}</div>
            <div className="text-[10px] uppercase tracking-wide text-accent mt-1">{auth.primaryRoleLabel}</div>
          </div>
          <nav className="p-3 space-y-2">
            {sections.map((section, idx) => {
              const isOpen = expanded[section.label] ?? false;
              return (
                <div key={section.label} className={idx > 0 ? "pt-2 border-t border-sidebar-foreground/10" : ""}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[10px] uppercase tracking-wide font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-1 mt-1">
                      {section.items.map((i) => {
                        const active = isNavActive(i.to);
                        return (
                          <Link
                            key={i.to}
                            to={i.to}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
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
                  )}
                </div>
              );
            })}
          </nav>
          <div className="hidden md:block p-3 mt-auto">
            <Button onClick={onLogout} variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="size-4 mr-2" /> Sign out
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Desktop top bar — notification bell pinned to the top-right corner */}
          {auth.user && (
            <header className="hidden md:flex sticky top-0 z-30 items-center justify-end gap-2 h-14 px-8 bg-background/80 backdrop-blur border-b border-border">
              <NotificationBell
                items={notify.items}
                unreadCount={notify.unreadCount}
                markRead={notify.markRead}
                markAllRead={notify.markAllRead}
              />
            </header>
          )}
          <main className="p-4 md:p-8">{children}</main>
        </div>
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
