import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/reports/individual")({
  ssr: false,
  component: IndividualReport,
});

interface ReportData {
  employee: {
    id: string;
    fullName: string;
    email: string;
    jobTitle?: { id: string; name: string };
    supervisor?: { id: string; fullName: string };
  };
  summary: {
    totalEvaluations?: number;
    averageScore?: number | null;
    totalDevPlans?: number;
    openDevPlans?: number;
    totalQuizAttempts?: number;
    averageQuizScore?: number | null;
  };
  evaluations: {
    id: string;
    evaluatorType: string;
    createdAt: string;
    overallPercent: number;
    scores: { id: string; score: number; competency: { id: string; name: string } }[];
  }[];
  developmentPlans: { id: string; title: string; status: string; items: unknown[] }[];
  quizAttempts: {
    id: string;
    scorePct: number;
    submittedAt?: string;
    assignment?: { quiz?: { title: string } };
  }[];
}

function IndividualReport() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string>("");
  const [expandedEvals, setExpandedEvals] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log("IndividualReport - user:", user?.id);
    if (!user?.id) {
      console.log("IndividualReport - no user, skipping");
      return;
    }
    console.log("IndividualReport - fetching individual report for user:", user.id);
    api
      .get<ReportData>(`/api/reports/individual/${user.id}`)
      .then((result) => {
        console.log("IndividualReport - got data:", result);
        setData(result);
        setError("");
      })
      .catch((err) => {
        console.error("IndividualReport - error:", err);
        setError(err?.message ?? "Failed to load report");
      });
  }, [user?.id]);

  if (authLoading || !data) {
    return (
      <div>
        <PageHeader
          title="My Performance Report"
          subtitle="Your personal performance summary. Only you can see this."
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
          <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
          <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
          <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Performance Report" subtitle="Personal performance summary" />
        <Card className="border-destructive">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const { evaluations = [], quizAttempts = [], summary } = data;

  const exportPDF = () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { margin: 0 0 10px 0; font-size: 24px; }
            .subtitle { color: #666; margin: 0 0 10px 0; font-size: 14px; }
            .info { color: #999; font-size: 11px; margin: 0 0 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background-color: #f0f0f0; border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold; }
            td { border: 1px solid #999; padding: 8px; }
            .center { text-align: center; }
            .competency-section { margin-top: 15px; page-break-inside: avoid; }
            .competency-item { background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; }
            .competency-name { font-weight: bold; margin-bottom: 5px; }
            .competency-score { font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>My Performance Report</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
          <p class="info">Self & Supervisor Evaluations: Based on competency assessments | Quiz Scores: Assessment quiz results</p>

          <table>
            <thead>
              <tr>
                <th>Evaluation Type</th>
                <th>Date</th>
                <th class="center">Score</th>
              </tr>
            </thead>
            <tbody>
              ${evaluations
                .map(
                  (e) => `
                <tr>
                  <td>${e.evaluatorType.charAt(0).toUpperCase() + e.evaluatorType.slice(1)}</td>
                  <td>${new Date(e.createdAt).toLocaleDateString()}</td>
                  <td class="center">${e.overallPercent.toFixed(0)}%</td>
                </tr>
                ${
                  e.scores && e.scores.length > 0
                    ? `
                <tr>
                  <td colspan="3">
                    <div class="competency-section">
                      <strong>Competencies:</strong>
                      ${e.scores
                        .map(
                          (s) => `
                      <div class="competency-item">
                        <div class="competency-name">${s.competency.name}</div>
                        <div class="competency-score">Score: ${(s.score / 20).toFixed(1)}/5</div>
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

          ${
            quizAttempts.length > 0
              ? `
          <h2 style="margin-top: 30px; font-size: 18px;">Quiz Attempts</h2>
          <table>
            <thead>
              <tr>
                <th>Quiz Title</th>
                <th class="center">Score</th>
                <th class="center">Date</th>
              </tr>
            </thead>
            <tbody>
              ${quizAttempts
                .map(
                  (q) => `
              <tr>
                <td>${q.assignment?.quiz?.title ?? "Quiz"}</td>
                <td class="center">${q.scorePct.toFixed(0)}%</td>
                <td class="center">${q.submittedAt ? new Date(q.submittedAt).toLocaleDateString() : "—"}</td>
              </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          `
              : ""
          }
        </body>
        </html>
      `;

      const opt = {
        margin: 10,
        filename: `my-report-${new Date().toISOString().split("T")[0]}.pdf`,
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
      const data = evaluations.map((e) => ({
        "Evaluation Type": e.evaluatorType.charAt(0).toUpperCase() + e.evaluatorType.slice(1),
        Date: new Date(e.createdAt).toLocaleDateString(),
        Score: `${e.overallPercent.toFixed(0)}%`,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Evaluations");

      const infoData = [
        ["My Performance Report"],
        [],
        ["Report Details:"],
        ["Self Evaluation", "Your self-assessment of competencies"],
        ["Supervisor Evaluation", "Your supervisor's assessment of your competencies"],
        ["Quiz Scores", "Assessment quiz results"],
      ];
      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      XLSX.utils.book_append_sheet(wb, infoWs, "About");

      XLSX.writeFile(wb, `my-report-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel");
    }
  };

  const toggleExpand = (evalId: string) => {
    const newExpanded = new Set(expandedEvals);
    if (newExpanded.has(evalId)) {
      newExpanded.delete(evalId);
    } else {
      newExpanded.add(evalId);
    }
    setExpandedEvals(newExpanded);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    return score >= 60 ? "text-success" : "text-destructive";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Performance Report"
        subtitle="Your personal performance summary. Only you can see this."
      />

      {/* Analytics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Avg Self-Evaluation</div>
            <div className={`text-3xl font-bold mt-2 ${getScoreColor(summary?.averageScore ?? null)}`}>
              {summary?.averageScore !== null && summary?.averageScore !== undefined ? `${summary.averageScore.toFixed(0)}%` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Evaluations</div>
            <div className="text-3xl font-bold mt-2">{summary?.totalEvaluations ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Avg Quiz Score</div>
            <div className={`text-3xl font-bold mt-2 ${getScoreColor(summary?.averageQuizScore ?? null)}`}>
              {summary?.averageQuizScore !== null && summary?.averageQuizScore !== undefined ? `${summary.averageQuizScore.toFixed(0)}%` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Open Dev Plans</div>
            <div className="text-3xl font-bold mt-2">{summary?.openDevPlans ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">My Evaluations</CardTitle>
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
          {evaluations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No evaluations yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Evaluation Type</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="text-center font-semibold">Score</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => {
                    const isExpanded = expandedEvals.has(evaluation.id);
                    return (
                      <>
                        <TableRow
                          key={evaluation.id}
                          onClick={() => toggleExpand(evaluation.id)}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                              />
                              {evaluation.evaluatorType.charAt(0).toUpperCase() + evaluation.evaluatorType.slice(1)}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(evaluation.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(evaluation.overallPercent)}`}>
                            {evaluation.overallPercent.toFixed(0)}%
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${evaluation.overallPercent >= 60 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                              {evaluation.overallPercent >= 60 ? "Pass" : "Fail"}
                            </span>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={4} className="p-0">
                              <div className="p-4 space-y-2">
                                <div className="font-semibold text-sm mb-3">Competencies:</div>
                                {evaluation.scores && evaluation.scores.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {evaluation.scores.map((score) => (
                                      <div key={score.id} className="border rounded-lg p-3 bg-white">
                                        <div className="font-medium text-sm mb-2">{score.competency.name}</div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Score: </span>
                                          <span className={`font-semibold ${getScoreColor((score.score / 20) * 100)}`}>
                                            {(score.score / 20).toFixed(1)}/5
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground py-4">No competency assessments.</div>
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

      {/* Quiz Attempts */}
      {quizAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Quiz Title</TableHead>
                    <TableHead className="text-center font-semibold">Score</TableHead>
                    <TableHead className="text-center font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.assignment?.quiz?.title ?? "Quiz"}</TableCell>
                      <TableCell className={`text-center font-semibold ${getScoreColor(attempt.scorePct)}`}>
                        {attempt.scorePct.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
