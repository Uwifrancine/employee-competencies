import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, CheckCircle, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  ssr: false,
  component: AdminAnalytics,
});

interface AnalyticsData {
  totalEmployees: number;
  totalEvaluations: number;
  averageScore: number | null;
  developmentPlansByStatus: Record<string, number>;
  quizAttempts: number;
  averageQuizScore: number | null;
  topCompetencies: Array<{ competencyId: string; name: string; avgScore: number | null }>;
}

function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AnalyticsData>("/api/reports/org")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading analytics…</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground">Unable to load analytics data</div>;
  }

  const planData = [
    { name: "Open", value: data.developmentPlansByStatus.open || 0, fill: "#f59e0b" },
    { name: "In Progress", value: data.developmentPlansByStatus.in_progress || 0, fill: "#3b82f6" },
    { name: "Completed", value: data.developmentPlansByStatus.completed || 0, fill: "#10b981" },
  ];

  const competencyData = (data.topCompetencies || []).slice(0, 8).map((c) => ({
    name: c.name.substring(0, 12),
    score: Math.round(c.avgScore ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Organization-wide performance metrics and insights."
      />

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          icon={<Users className="size-5" />}
          label="Total Employees"
          value={data.totalEmployees}
          subtext="Organization-wide"
        />
        <MetricCard
          icon={<CheckCircle className="size-5" />}
          label="Evaluations"
          value={data.totalEvaluations}
          subtext={`Avg: ${data.averageScore?.toFixed(0) ?? "—"}%`}
        />
        <MetricCard
          icon={<Clock className="size-5" />}
          label="Dev Plans"
          value={data.developmentPlansByStatus.completed || 0}
          subtext={`${(data.developmentPlansByStatus.open || 0) + (data.developmentPlansByStatus.in_progress || 0)} in progress`}
        />
        <MetricCard
          icon={<TrendingUp className="size-5" />}
          label="Quiz Score Avg"
          value={`${data.averageQuizScore?.toFixed(0) ?? "—"}%`}
          subtext={`${data.quizAttempts} attempts`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Development Plans Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Development Plans Status</CardTitle>
          </CardHeader>
          <CardContent>
            {planData.some((p) => p.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12">No development plans data available</div>
            )}
          </CardContent>
        </Card>

        {/* Evaluation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evaluation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Evaluations Conducted</div>
                <div className="text-3xl font-bold">{data.totalEvaluations}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Average Score</div>
                <div className="text-3xl font-bold text-primary">{data.averageScore?.toFixed(0) ?? "—"}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Competencies Bar Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Top Competencies by Score</CardTitle>
        </CardHeader>
        <CardContent>
          {competencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={competencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-center py-12">No competency data available</div>
          )}
        </CardContent>
      </Card>

      {/* Top Competencies List */}
      {(data.topCompetencies || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competency Scores Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topCompetencies.map((comp, idx) => {
                const score = comp.avgScore ?? 0;
                return (
                  <div key={idx} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{comp.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${score >= 60 ? "bg-success" : "bg-warning"}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                      <div className={`text-sm font-semibold w-12 text-right ${score >= 60 ? "text-success" : "text-warning"}`}>
                        {score.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
          </div>
          <div className="text-primary opacity-60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
