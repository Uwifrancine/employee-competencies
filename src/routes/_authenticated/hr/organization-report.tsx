import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/hr/organization-report")({
  ssr: false,
  component: OrganizationReport,
});

interface CompetencyScore {
  competencyId: string;
  competencyName: string;
  selfScore: number | null;
  supervisorScore: number | null;
}

interface QuizAttempt {
  id: string;
  title: string;
  scorePct: number;
  submittedAt: string;
}

interface EmployeeData {
  id: string;
  fullName: string;
  email: string;
  jobTitle: { id: string; name: string } | null;
  selfEvalScore: number | null;
  supervisorEvalScore: number | null;
  quizScore: number | null;
  status: "active" | "inactive";
  evaluationStatus: "completed" | "pending" | "self_only" | "none";
  competencies: CompetencyScore[];
  quizAttempts: QuizAttempt[];
}

function OrganizationReport() {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [employeesRes, assignmentsRes] = await Promise.all([
        api.get<any[]>("/api/employees"),
        api.get<any[]>("/api/quiz-assignments"),
      ]);

      const employees = employeesRes || [];
      const assignments = assignmentsRes || [];

      const reportData: EmployeeData[] = [];

      for (const emp of employees) {
        try {
          const evalRes = await api.get<any>(`/api/reports/individual/${emp.id}`);
          const evals = evalRes?.evaluations || [];
          const selfEval = evals.find((e: any) => e.evaluatorType === "self");
          const supEval = evals.find((e: any) => e.evaluatorType === "supervisor");
          const quizAssignments = assignments.filter((a) => a.employee?.id === emp.id && a.attempts?.length > 0);
          const quizAttempt = quizAssignments.sort((a, b) => new Date(b.attempts[0].submittedAt).getTime() - new Date(a.attempts[0].submittedAt).getTime())[0];

          let evaluationStatus: "completed" | "pending" | "self_only" | "none" = "none";
          if (selfEval && supEval) {
            evaluationStatus = "completed";
          } else if (selfEval) {
            evaluationStatus = "self_only";
          } else if (supEval) {
            evaluationStatus = "pending";
          }

          // Build competencies map
          const competencyMap = new Map<string, CompetencyScore>();

          if (selfEval?.scores && Array.isArray(selfEval.scores)) {
            selfEval.scores.forEach((s: any) => {
              competencyMap.set(s.competencyId, {
                competencyId: s.competencyId,
                competencyName: s.competency?.name || `Competency ${s.competencyId}`,
                selfScore: s.score ? s.score / 20 : null,
                supervisorScore: null,
              });
            });
          }

          if (supEval?.scores && Array.isArray(supEval.scores)) {
            supEval.scores.forEach((s: any) => {
              const existing = competencyMap.get(s.competencyId);
              if (existing) {
                existing.supervisorScore = s.score ? s.score / 20 : null;
              } else {
                competencyMap.set(s.competencyId, {
                  competencyId: s.competencyId,
                  competencyName: s.competency?.name || `Competency ${s.competencyId}`,
                  selfScore: null,
                  supervisorScore: s.score ? s.score / 20 : null,
                });
              }
            });
          }

          // Build quiz attempts
          const quizAttempts: QuizAttempt[] = quizAssignments.map((a: any) => ({
            id: a.attempts[0].id,
            title: a.quiz?.title || "Quiz",
            scorePct: a.attempts[0].scorePct,
            submittedAt: a.attempts[0].submittedAt,
          }));

          reportData.push({
            id: emp.id,
            fullName: emp.fullName,
            email: emp.email,
            jobTitle: emp.jobTitle,
            selfEvalScore: selfEval?.overallPercent ?? null,
            supervisorEvalScore: supEval?.overallPercent ?? null,
            quizScore: quizAttempt?.attempts?.[0]?.scorePct ?? null,
            status: emp.isActive ? "active" : "inactive",
            evaluationStatus,
            competencies: Array.from(competencyMap.values()),
            quizAttempts,
          });
        } catch (err) {
          console.error(`Failed to load data for ${emp.fullName}:`, err);
        }
      }

      setEmployees(reportData);
    } catch (err) {
      console.error("Failed to load report:", err);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (empId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(empId)) {
      newExpanded.delete(empId);
    } else {
      newExpanded.add(empId);
    }
    setExpandedRows(newExpanded);
  };

  const stats = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((e) => e.status === "active").length,
    completedEvaluations: employees.filter((e) => e.evaluationStatus === "completed").length,
    avgSelfEval:
      employees.filter((e) => e.selfEvalScore !== null).length > 0
        ? employees.filter((e) => e.selfEvalScore !== null).reduce((sum, e) => sum + (e.selfEvalScore || 0), 0) /
          employees.filter((e) => e.selfEvalScore !== null).length
        : null,
    avgSupervisorEval:
      employees.filter((e) => e.supervisorEvalScore !== null).length > 0
        ? employees.filter((e) => e.supervisorEvalScore !== null).reduce((sum, e) => sum + (e.supervisorEvalScore || 0), 0) /
          employees.filter((e) => e.supervisorEvalScore !== null).length
        : null,
    passRate:
      employees.filter((e) => e.supervisorEvalScore !== null).length > 0
        ? (employees.filter((e) => (e.supervisorEvalScore ?? 0) >= 60).length /
            employees.filter((e) => e.supervisorEvalScore !== null).length) *
          100
        : null,
    avgQuizScore:
      employees.filter((e) => e.quizScore !== null).length > 0
        ? employees.filter((e) => e.quizScore !== null).reduce((sum, e) => sum + (e.quizScore || 0), 0) /
          employees.filter((e) => e.quizScore !== null).length
        : null,
  };

  const exportPDF = () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { margin: 0 0 10px 0; font-size: 24px; }
            h2 { margin: 20px 0 10px 0; font-size: 16px; }
            .subtitle { color: #666; margin: 0 0 10px 0; font-size: 14px; }
            .info { color: #999; font-size: 11px; margin: 0 0 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
            th { background-color: #f0f0f0; border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold; }
            td { border: 1px solid #999; padding: 8px; }
            .center { text-align: center; }
            .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .stat-box { flex: 1; min-width: 150px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
            .stat-label { color: #666; font-size: 11px; }
            .stat-value { font-size: 18px; font-weight: bold; color: #000; margin-top: 5px; }
          </style>
        </head>
        <body>
          <h1>Organization Performance Report</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
          <p class="info">Comprehensive view of all employee evaluations, quiz performance, and completion status</p>

          <h2>Key Statistics</h2>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">Total Employees</div>
              <div class="stat-value">${stats.totalEmployees}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Completed Evaluations</div>
              <div class="stat-value">${stats.completedEvaluations}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Pass Rate</div>
              <div class="stat-value">${stats.passRate !== null ? stats.passRate.toFixed(0) : "—"}%</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Avg Quiz Score</div>
              <div class="stat-value">${stats.avgQuizScore !== null ? stats.avgQuizScore.toFixed(0) : "—"}%</div>
            </div>
          </div>

          <h2>Employee Evaluations & Performance</h2>
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Job Title</th>
                <th class="center">Self Eval</th>
                <th class="center">Supervisor Eval</th>
                <th class="center">Quiz Score</th>
                <th class="center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${employees
                .map(
                  (e) => `
              <tr>
                <td>${e.fullName}</td>
                <td>${e.jobTitle?.name || "—"}</td>
                <td class="center">${e.selfEvalScore !== null ? e.selfEvalScore.toFixed(0) : "—"}%</td>
                <td class="center">${e.supervisorEvalScore !== null ? e.supervisorEvalScore.toFixed(0) : "—"}%</td>
                <td class="center">${e.quizScore !== null ? e.quizScore.toFixed(0) : "—"}%</td>
                <td class="center">${
                  e.evaluationStatus === "completed"
                    ? "✓ Complete"
                    : e.evaluationStatus === "self_only"
                      ? "⊙ Self Only"
                      : e.evaluationStatus === "pending"
                        ? "⊘ Pending"
                        : "—"
                }</td>
              </tr>
              ${
                e.competencies && e.competencies.length > 0
                  ? `
              <tr>
                <td colspan="6">
                  <div class="competency-section">
                    <strong>Competencies:</strong>
                    ${e.competencies
                      .map(
                        (c) => `
                    <div class="competency-item">
                      <div class="competency-name">${c.competencyName}</div>
                      <div class="competency-score">
                        Self: ${c.selfScore !== null ? c.selfScore.toFixed(1) : "—"}/5 |
                        Supervisor: ${c.supervisorScore !== null ? c.supervisorScore.toFixed(1) : "—"}/5
                      </div>
                    </div>
                    `
                      )
                      .join("")}
                  </div>
                </td>
              </tr>
              `
                  : ""
              }
              ${
                e.quizAttempts && e.quizAttempts.length > 0
                  ? `
              <tr>
                <td colspan="6">
                  <div class="competency-section">
                    <strong>Quiz Attempts:</strong>
                    ${e.quizAttempts
                      .map(
                        (q) => `
                    <div class="competency-item">
                      <div class="competency-name">${q.title}</div>
                      <div class="competency-score">
                        Score: ${q.scorePct != null ? q.scorePct.toFixed(0) + "%" : "—"} | Date: ${q.submittedAt ? new Date(q.submittedAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    `
                      )
                      .join("")}
                  </div>
                </td>
              </tr>
              `
                  : ""
              }
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const opt = {
        margin: 10,
        filename: `organization-report-${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: "landscape" as const, unit: "mm", format: "a4" },
      };

      html2pdf()
        .set(opt)
        .from(htmlContent)
        .save()
        .then(() => {
          toast.success("PDF exported successfully");
        })
        .catch((err: any) => {
          console.error("PDF export error:", err);
          toast.error("Failed to export PDF");
        });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF");
    }
  };

  const exportExcel = () => {
    try {
      const data = employees.map((e) => ({
        Employee: e.fullName,
        Email: e.email,
        "Job Title": e.jobTitle?.name || "—",
        "Self Evaluation": e.selfEvalScore !== null ? `${e.selfEvalScore.toFixed(0)}%` : "—",
        "Supervisor Evaluation": e.supervisorEvalScore !== null ? `${e.supervisorEvalScore.toFixed(0)}%` : "—",
        "Quiz Score": e.quizScore !== null ? `${e.quizScore.toFixed(0)}%` : "—",
        Status: e.evaluationStatus === "completed" ? "Complete" : e.evaluationStatus === "self_only" ? "Self Only" : e.evaluationStatus === "pending" ? "Pending" : "None",
        "Employee Status": e.status === "active" ? "Active" : "Inactive",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");

      const statsData = [
        ["Organization Performance Report"],
        ["Generated", new Date().toLocaleDateString()],
        [],
        ["Key Metrics"],
        ["Total Employees", stats.totalEmployees],
        ["Active Employees", stats.activeEmployees],
        ["Completed Evaluations", stats.completedEvaluations],
        ["Avg Self-Evaluation", stats.avgSelfEval !== null ? `${stats.avgSelfEval.toFixed(0)}%` : "—"],
        ["Avg Supervisor Evaluation", stats.avgSupervisorEval !== null ? `${stats.avgSupervisorEval.toFixed(0)}%` : "—"],
        ["Pass Rate", stats.passRate !== null ? `${stats.passRate.toFixed(0)}%` : "—"],
        ["Avg Quiz Score", stats.avgQuizScore !== null ? `${stats.avgQuizScore.toFixed(0)}%` : "—"],
      ];
      const statsWs = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, statsWs, "Summary");

      XLSX.writeFile(wb, `organization-report-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "✓ Complete";
      case "self_only":
        return "⊙ Self Only";
      case "pending":
        return "⊘ Pending";
      default:
        return "—";
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    return score >= 60 ? "text-success" : "text-destructive";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organization Performance Report"
        subtitle="Comprehensive view of all employee evaluations and performance metrics"
      />

      {/* Key Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Employees</div>
            <div className="text-3xl font-bold mt-2">{stats.totalEmployees}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.activeEmployees} active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Completed Evaluations</div>
            <div className="text-3xl font-bold mt-2 text-success">{stats.completedEvaluations}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.totalEmployees > 0 ? `${((stats.completedEvaluations / stats.totalEmployees) * 100).toFixed(0)}%` : "0%"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pass Rate (Supervisor Eval)</div>
            <div className={`text-3xl font-bold mt-2 ${stats.passRate !== null && stats.passRate >= 60 ? "text-success" : "text-destructive"}`}>
              {stats.passRate !== null ? `${stats.passRate.toFixed(0)}%` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Avg Quiz Score</div>
            <div className={`text-3xl font-bold mt-2 ${stats.avgQuizScore !== null && stats.avgQuizScore >= 60 ? "text-success" : "text-destructive"}`}>
              {stats.avgQuizScore !== null ? `${stats.avgQuizScore.toFixed(0)}%` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">All Employees Performance Overview</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={exportPDF} variant="outline">
              <FileText className="size-4 mr-1" /> PDF
            </Button>
            <Button size="sm" onClick={exportExcel} variant="outline">
              <Download className="size-4 mr-1" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading report...</div>
          ) : employees.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No employees found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Job Title</TableHead>
                    <TableHead className="text-center font-semibold">Self Eval</TableHead>
                    <TableHead className="text-center font-semibold">Supervisor Eval</TableHead>
                    <TableHead className="text-center font-semibold">Quiz Score</TableHead>
                    <TableHead className="text-center font-semibold">Evaluation Status</TableHead>
                    <TableHead className="text-center font-semibold">Employee Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const isExpanded = expandedRows.has(employee.id);
                    return (
                      <>
                        <TableRow
                          key={employee.id}
                          onClick={() => toggleExpand(employee.id)}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                              />
                              {employee.fullName}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{employee.email}</TableCell>
                          <TableCell>{employee.jobTitle?.name || "—"}</TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(employee.selfEvalScore)}`}>
                            {employee.selfEvalScore !== null ? `${employee.selfEvalScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(employee.supervisorEvalScore)}`}>
                            {employee.supervisorEvalScore !== null ? `${employee.supervisorEvalScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(employee.quizScore)}`}>
                            {employee.quizScore !== null ? `${employee.quizScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                employee.evaluationStatus === "completed"
                                  ? "bg-success text-success-foreground"
                                  : employee.evaluationStatus === "self_only"
                                    ? "bg-amber-100 text-amber-800"
                                    : employee.evaluationStatus === "pending"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {getStatusBadge(employee.evaluationStatus)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${employee.status === "active" ? "bg-success/20 text-success" : "bg-gray-100 text-gray-800"}`}>
                              {employee.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 space-y-4">
                                {/* Competencies */}
                                <div>
                                  <div className="font-semibold text-sm mb-3">Competencies Breakdown:</div>
                                  {employee.competencies && employee.competencies.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {employee.competencies.map((comp) => (
                                        <div key={comp.competencyId} className="border rounded-lg p-3 bg-white">
                                          <div className="font-medium text-sm mb-2">{comp.competencyName}</div>
                                          <div className="flex justify-between text-xs gap-2">
                                            <div>
                                              <span className="text-muted-foreground">Self: </span>
                                              <span className={`font-semibold ${getScoreColor(comp.selfScore ? comp.selfScore * 20 : null)}`}>
                                                {comp.selfScore !== null ? `${comp.selfScore.toFixed(1)}/5` : "—"}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Supervisor: </span>
                                              <span className={`font-semibold ${getScoreColor(comp.supervisorScore ? comp.supervisorScore * 20 : null)}`}>
                                                {comp.supervisorScore !== null ? `${comp.supervisorScore.toFixed(1)}/5` : "—"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground py-4">No competency assessments yet.</div>
                                  )}
                                </div>

                                {/* Quiz Attempts */}
                                {employee.quizAttempts.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-sm mb-3">Quiz Attempts:</div>
                                    <div className="space-y-2">
                                      {employee.quizAttempts.map((quiz) => (
                                        <div key={quiz.id} className="border rounded-lg p-3 bg-white flex justify-between items-center">
                                          <div>
                                            <div className="font-medium text-sm">{quiz.title}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {new Date(quiz.submittedAt).toLocaleDateString()}
                                            </div>
                                          </div>
                                          <div className={`font-semibold text-sm ${getScoreColor(quiz.scorePct)}`}>
                                            {quiz.scorePct.toFixed(0)}%
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
