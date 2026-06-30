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

export const Route = createFileRoute("/_authenticated/supervisor/report")({
  ssr: false,
  component: SupervisorReport,
});

interface CompetencyScore {
  competencyId: string;
  competencyName: string;
  selfScore: number | null;
  supervisorScore: number | null;
}

interface TeamMemberReport {
  id: string;
  fullName: string;
  jobTitle: string;
  selfEvalScore: number | null;
  supervisorEvalScore: number | null;
  quizScore: number | null;
  selfEvalDate: string | null;
  supervisorEvalDate: string | null;
  quizDate: string | null;
  competencies: CompetencyScore[];
}

function SupervisorReport() {
  const [members, setMembers] = useState<TeamMemberReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Get team members - /api/employees returns only supervisor's direct reports when called by supervisor
      const [teamMembersRes, assignmentsRes] = await Promise.all([
        api.get<any[]>("/api/employees"),
        api.get<any[]>("/api/quiz-assignments"),
      ]);

      const teamMembers = teamMembersRes || [];
      const assignments = assignmentsRes || [];

      console.log("Team members from /api/employees:", teamMembers);

      // Fetch evaluations for each team member
      const reportData: TeamMemberReport[] = [];

      for (const member of teamMembers) {
        try {
          const memberEvals = await api.get<any>(`/api/reports/individual/${member.id}`);
          const selfEval = memberEvals?.evaluations?.find((e: any) => e.evaluatorType === "self");
          const supEval = memberEvals?.evaluations?.find((e: any) => e.evaluatorType === "supervisor");
          const quizAttempt = assignments
            .filter((a) => a.employee?.id === member.id && a.attempts?.length > 0)
            .sort((a, b) => new Date(b.attempts[0].submittedAt).getTime() - new Date(a.attempts[0].submittedAt).getTime())[0];

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

          reportData.push({
            id: member.id,
            fullName: member.fullName,
            jobTitle: member.jobTitle?.name || "—",
            selfEvalScore: selfEval?.overallPercent ?? null,
            supervisorEvalScore: supEval?.overallPercent ?? null,
            quizScore: quizAttempt?.attempts?.[0]?.scorePct ?? null,
            selfEvalDate: selfEval?.createdAt ?? null,
            supervisorEvalDate: supEval?.createdAt ?? null,
            quizDate: quizAttempt?.attempts?.[0]?.submittedAt ?? null,
            competencies: Array.from(competencyMap.values()),
          });
        } catch (err) {
          console.error(`Failed to load evaluations for ${member.fullName}:`, err);
        }
      }

      console.log("Report data:", reportData);
      setMembers(reportData);
    } catch (err) {
      console.error("Failed to load report:", err);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
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
            .subtitle { color: #666; margin: 0 0 10px 0; font-size: 14px; }
            .info { color: #999; font-size: 11px; margin: 0 0 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background-color: #f0f0f0; border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold; }
            td { border: 1px solid #999; padding: 8px; }
            .center { text-align: center; }
            .competency-section { margin-top: 15px; page-break-inside: avoid; }
            .competency-item { background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; }
            .competency-name { font-weight: bold; margin-bottom: 5px; }
            .competency-scores { font-size: 10px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h1>Team Evaluation Report</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
          <p class="info">Self Eval & Supervisor Eval: Based on competency assessments | Quiz Score: Assessment quiz results</p>

          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job Title</th>
                <th class="center">Self Eval</th>
                <th class="center">Supervisor Eval</th>
                <th class="center">Quiz Score</th>
              </tr>
            </thead>
            <tbody>
              ${members
                .map(
                  (m) => `
                <tr>
                  <td>${m.fullName}</td>
                  <td>${m.jobTitle}</td>
                  <td class="center">${m.selfEvalScore !== null ? `${m.selfEvalScore.toFixed(0)}%` : "—"}</td>
                  <td class="center">${m.supervisorEvalScore !== null ? `${m.supervisorEvalScore.toFixed(0)}%` : "—"}</td>
                  <td class="center">${m.quizScore !== null ? `${m.quizScore.toFixed(0)}%` : "—"}</td>
                </tr>
                ${
                  m.competencies && m.competencies.length > 0
                    ? `
                <tr>
                  <td colspan="5">
                    <div class="competency-section">
                      <strong>Competencies:</strong>
                      ${m.competencies
                        .map(
                          (c) => `
                      <div class="competency-item">
                        <div class="competency-name">${c.competencyName}</div>
                        <div class="competency-scores">
                          <span>Self: ${c.selfScore !== null ? c.selfScore.toFixed(1) : "—"}/5</span>
                          <span>Supervisor: ${c.supervisorScore !== null ? c.supervisorScore.toFixed(1) : "—"}/5</span>
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
        filename: `team-report-${new Date().toISOString().split("T")[0]}.pdf`,
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
      const data = members.map((m) => ({
        Employee: m.fullName,
        "Job Title": m.jobTitle,
        "Self Evaluation": m.selfEvalScore !== null ? `${m.selfEvalScore.toFixed(0)}%` : "—",
        "Supervisor Evaluation": m.supervisorEvalScore !== null ? `${m.supervisorEvalScore.toFixed(0)}%` : "—",
        "Quiz Score": m.quizScore !== null ? `${m.quizScore.toFixed(0)}%` : "—",
        "Self Eval Date": m.selfEvalDate ? new Date(m.selfEvalDate).toLocaleDateString() : "—",
        "Supervisor Eval Date": m.supervisorEvalDate ? new Date(m.supervisorEvalDate).toLocaleDateString() : "—",
        "Quiz Date": m.quizDate ? new Date(m.quizDate).toLocaleDateString() : "—",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Team Report");

      const infoData = [
        ["Team Evaluation Report"],
        [],
        ["Report Details:"],
        ["Self Evaluation", "Based on employee self-assessment of competencies"],
        ["Supervisor Evaluation", "Based on supervisor assessment of employee competencies"],
        ["Quiz Score", "Based on assessment quiz completed by employee"],
      ];
      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      XLSX.utils.book_append_sheet(wb, infoWs, "About");

      XLSX.writeFile(wb, `team-report-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel");
    }
  };

  const toggleExpand = (memberId: string) => {
    const newExpanded = new Set(expandedMembers);
    if (newExpanded.has(memberId)) {
      newExpanded.delete(memberId);
    } else {
      newExpanded.add(memberId);
    }
    setExpandedMembers(newExpanded);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    return score >= 60 ? "text-success" : "text-destructive";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team Evaluation Report"
        subtitle="Comprehensive view of all team member evaluations and quiz scores"
      />

      {members.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Team Members</div>
              <div className="text-3xl font-bold mt-2">{members.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Completed Evaluations</div>
              <div className="text-3xl font-bold mt-2 text-success">
                {members.filter((m) => m.selfEvalScore !== null && m.supervisorEvalScore !== null).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Avg Quiz Score</div>
              <div className="text-3xl font-bold mt-2">
                {members.filter((m) => m.quizScore !== null).length > 0
                  ? (
                      members
                        .filter((m) => m.quizScore !== null)
                        .reduce((sum, m) => sum + m.quizScore!, 0) / members.filter((m) => m.quizScore !== null).length
                    ).toFixed(0)
                  : "—"}
                {members.filter((m) => m.quizScore !== null).length > 0 ? "%" : ""}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Overall Pass Rate</div>
              <div className="text-3xl font-bold mt-2 text-success">
                {members.length > 0
                  ? (
                      (members.filter((m) => (m.supervisorEvalScore ?? 0) >= 60).length / members.length) *
                      100
                    ).toFixed(0)
                  : "0"}
                %
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Team Members Evaluation Summary</CardTitle>
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
          ) : members.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No team members found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table id="report-table">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Job Title</TableHead>
                    <TableHead className="text-center font-semibold">
                      <div>Self Evaluation</div>
                      <div className="text-xs text-muted-foreground font-normal">(Competencies)</div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div>Supervisor Evaluation</div>
                      <div className="text-xs text-muted-foreground font-normal">(Competencies)</div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div>Quiz Score</div>
                      <div className="text-xs text-muted-foreground font-normal">(Assessment)</div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isComplete =
                      member.selfEvalScore !== null &&
                      member.supervisorEvalScore !== null &&
                      member.quizScore !== null;
                    const isExpanded = expandedMembers.has(member.id);

                    return (
                      <>
                        <TableRow
                          key={member.id}
                          onClick={() => toggleExpand(member.id)}
                          className={`${isComplete ? "bg-success/5" : ""} cursor-pointer hover:bg-muted/50 transition-colors`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                              />
                              {member.fullName}
                            </div>
                          </TableCell>
                          <TableCell>{member.jobTitle}</TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(member.selfEvalScore)}`}>
                            {member.selfEvalScore !== null ? `${member.selfEvalScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(member.supervisorEvalScore)}`}>
                            {member.supervisorEvalScore !== null ? `${member.supervisorEvalScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${getScoreColor(member.quizScore)}`}>
                            {member.quizScore !== null ? `${member.quizScore.toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {isComplete ? (
                              <span className="px-2 py-1 rounded-full bg-success text-success-foreground text-xs font-semibold">
                                Complete
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                                Pending
                              </span>
                            )}
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4 space-y-2">
                                <div className="font-semibold text-sm mb-3">Competencies Breakdown:</div>
                                {member.competencies && member.competencies.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {member.competencies.map((comp) => (
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
