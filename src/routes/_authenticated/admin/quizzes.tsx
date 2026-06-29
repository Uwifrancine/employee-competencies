import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/quizzes")({
  ssr: false,
  component: AdminQuizzes,
});

function AdminQuizzes() {
  return (
    <div>
      <PageHeader
        title="Quizzes"
        subtitle="Quiz management is handled by supervisors. You do not have access to this section."
      />
      <Card>
        <CardContent className="p-12 text-center space-y-4">
          <div className="flex justify-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="size-8 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Access Restricted</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Quiz management is only available to supervisors. Supervisors can create and manage quizzes from their dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
