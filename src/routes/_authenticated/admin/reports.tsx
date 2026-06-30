import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Sheet } from "lucide-react";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  ssr: false,
  component: AdminReports,
});

interface JobTitleReport {
  id: string;
  name: string;
  description: string | null;
  employeeCount: number;
  employees: Array<{
    id: string;
    fullName: string;
    email: string;
    evaluations: Array<{
      id: string;
      overallPercent: number;
      createdAt: string;
    }>;
  }>;
}

function AdminReports() {
  const [data, setData] = useState<JobTitleReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const jobTitles = await api.get<any[]>("/api/job-titles");

      const reportData: JobTitleReport[] = await Promise.all(
        jobTitles.map(async (jt) => {
          const employees = await api.get<any[]>(`/api/employees?jobTitleId=${jt.id}`);

          const employeesWithEvals = await Promise.all(
            employees.map(async (emp) => {
              try {
                const evals = await api.get<any>(`/api/reports/individual/${emp.id}`);
                return {
                  id: emp.id,
                  fullName: emp.fullName,
                  email: emp.email,
                  evaluations: evals?.evaluations || [],
                };
              } catch {
                return {
                  id: emp.id,
                  fullName: emp.fullName,
                  email: emp.email,
                  evaluations: [],
                };
              }
            })
          );

          return {
            id: jt.id,
            name: jt.name,
            description: jt.description,
            employeeCount: employeesWithEvals.length,
            employees: employeesWithEvals,
          };
        })
      );

      setData(reportData.filter((jt) => jt.employeeCount > 0));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const element = document.getElementById("report-content");
    if (!element) {
      toast.error("Report content not found");
      return;
    }

    const opt: any = {
      margin: 10,
      filename: `Job_Titles_Report_${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "landscape", unit: "mm", format: "a4" },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => toast.success("PDF downloaded successfully!"))
      .catch((err: any) => {
        console.error("PDF export error:", err);
        toast.error("Failed to export PDF");
      });
  };

  const downloadExcel = () => {
    const excelData = data.flatMap((jt) =>
      jt.employees.flatMap((emp) => [
        {
          "Job Title": jt.name,
          "Description": jt.description || "",
          "Employee Name": emp.fullName,
          "Email": emp.email,
          "Total Evaluations": emp.evaluations.length,
          "Average Score": emp.evaluations.length > 0
            ? (emp.evaluations.reduce((sum, e) => sum + e.overallPercent, 0) / emp.evaluations.length).toFixed(2)
            : "N/A",
        },
      ])
    );

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Job Titles Report");

    // Set column widths
    const columnWidths = [20, 25, 20, 25, 18, 15];
    worksheet["!cols"] = columnWidths.map((w) => ({ wch: w }));

    XLSX.writeFile(workbook, `Job_Titles_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel file downloaded successfully!");
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading report...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Job Titles Report"
        subtitle="View all job titles with their assigned employees and evaluations."
        action={
          <div className="flex gap-2">
            <Button onClick={downloadPDF} className="bg-red-600 hover:bg-red-700 text-white">
              <FileText className="size-4 mr-1" /> PDF
            </Button>
            <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white">
              <Sheet className="size-4 mr-1" /> Excel
            </Button>
          </div>
        }
      />

      {data.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No job titles with employees found.
          </CardContent>
        </Card>
      ) : (
        <div id="report-content">
          <Tabs defaultValue={data[0]?.id} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 4)}, 1fr)` }}>
              {data.map((jt) => (
                <TabsTrigger key={jt.id} value={jt.id} className="text-xs sm:text-sm">
                  {jt.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.map((jt) => (
              <TabsContent key={jt.id} value={jt.id} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{jt.name}</CardTitle>
                        {jt.description && <p className="text-sm text-muted-foreground mt-1">{jt.description}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{jt.employeeCount}</div>
                        <div className="text-xs text-muted-foreground">Employees</div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Total Evaluations</TableHead>
                          <TableHead className="text-center">Average Score</TableHead>
                          <TableHead>Latest Evaluation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jt.employees.map((emp) => {
                          const avgScore =
                            emp.evaluations.length > 0
                              ? emp.evaluations.reduce((sum, e) => sum + e.overallPercent, 0) / emp.evaluations.length
                              : 0;
                          const latestEval = emp.evaluations.length > 0 ? emp.evaluations[0] : null;

                          return (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">{emp.fullName}</TableCell>
                              <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                              <TableCell className="text-center">{emp.evaluations.length}</TableCell>
                              <TableCell className="text-center">
                                <span className={`font-semibold ${avgScore >= 60 ? "text-green-600" : "text-orange-600"}`}>
                                  {avgScore > 0 ? avgScore.toFixed(1) : "—"}%
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {latestEval ? (
                                  <div className="text-sm">
                                    <div className="font-medium">{latestEval.overallPercent.toFixed(1)}%</div>
                                    <div className="text-xs">
                                      {new Date(latestEval.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Evaluation Scores Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evaluation Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Total Evaluations</div>
                        <div className="text-2xl font-bold">
                          {jt.employees.reduce((sum, e) => sum + e.evaluations.length, 0)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Average Score</div>
                        <div className="text-2xl font-bold">
                          {(() => {
                            // Average of each evaluated employee's mean score — employees
                            // with no evaluations are excluded so they don't drag it down.
                            const evaluated = jt.employees.filter((e) => e.evaluations.length > 0);
                            if (evaluated.length === 0) return "—";
                            const avg =
                              evaluated.reduce(
                                (sum, e) =>
                                  sum +
                                  e.evaluations.reduce((s, ev) => s + ev.overallPercent, 0) /
                                    e.evaluations.length,
                                0
                              ) / evaluated.length;
                            return `${avg.toFixed(1)}%`;
                          })()}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Evaluated Employees</div>
                        <div className="text-2xl font-bold">{jt.employees.filter((e) => e.evaluations.length > 0).length}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
