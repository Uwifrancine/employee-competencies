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
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <p className="text-lg font-medium text-foreground">Loading your profile</p>
            <p className="text-sm text-muted-foreground mt-1">Initializing the application…</p>
          </div>
        </div>
      </div>
    );
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
          <div className="hidden md:block p-6 border-b border-sidebar-foreground/10">
            <div className="text-lg font-bold">Competency Manager</div>
          </div>
          <nav className="p-3 space-y-2">
            {sections.map((section, idx) => {
              const isOpen = expanded[section.label] ?? (idx === 0);
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
        </aside>

        <div className="min-w-0">
          {/* Desktop top bar — notification bell and profile menu pinned to the top-right corner */}
          {auth.user && (
            <header className="hidden md:flex sticky top-0 z-30 items-center justify-between gap-4 h-14 px-8 bg-background/80 backdrop-blur border-b border-border">
              <div></div>
              <div className="flex items-center gap-4">
                <NotificationBell
                  items={notify.items}
                  unreadCount={notify.unreadCount}
                  markRead={notify.markRead}
                  markAllRead={notify.markAllRead}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="flex items-center gap-3 px-3 py-2 h-auto bg-gray-100 hover:bg-gray-200 text-gray-900 border-0 rounded-lg transition-all duration-200 data-[state=open]:bg-gray-200 data-[state=open]:shadow-md">
                      <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center shrink-0">
                        <User className="size-5 text-gray-600" />
                      </div>
                      <div className="text-left hidden sm:block">
                        <div className="text-sm font-semibold leading-tight text-gray-900">{auth.profile?.full_name}</div>
                        <div className="text-xs text-gray-500">{auth.primaryRoleLabel}</div>
                      </div>
                      <ChevronDown className="size-4 text-gray-400 ml-1 shrink-0 transition-transform" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-0 border border-gray-200 shadow-lg">
                    <div className="px-4 py-4 bg-white">
                      <p className="font-semibold text-sm text-gray-900 leading-tight">{auth.profile?.full_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{auth.profile?.email}</p>
                      <div className="mt-3 inline-block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-md">{auth.primaryRoleLabel}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100"></div>
                    <div className="p-2">
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-md transition-colors duration-150"
                      >
                        <LogOut className="size-4 shrink-0" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
