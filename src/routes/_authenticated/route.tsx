import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const token = localStorage.getItem("auth_token");
    if (!token) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
