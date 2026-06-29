import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Sheet } from "lucide-react";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";

export const Route = createFileRoute("/_authenticated/hr/competencies-report")({
  ssr: false,
  component: CompetenciesReport,
});

interface JobTitle {
  id: string;
  name: string;
  description: string | null;
}

interface Competency {
  id: string;
  name: string;
  description: string | null;
  jobTitleId: string;
}

interface Employee {
  id: string;
  fullName: string;
  email: string;
  jobTitle: { id: string; name: string } | null;
  roles: { role: string }[];
}

function CompetenciesReport() {
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [allCompetencies, setAllCompetencies] = useState<Competency[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [filteredCompetencies, setFilteredCompetencies] = useState<Competency[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jts, comps, emps] = await Promise.all([
        api.get<JobTitle[]>("/api/job-titles"),
        api.get<Competency[]>("/api/competencies"),
        api.get<Employee[]>("/api/employees"),
      ]);
      setJobTitles(jts);
      setAllCompetencies(comps);
      setEmployees(emps);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJobTitle) {
      const comps = allCompetencies.filter((c) => c.jobTitleId === selectedJobTitle);
      const emps = employees.filter((e) => e.jobTitle?.id === selectedJobTitle);
      setFilteredCompetencies(comps);
      setFilteredEmployees(emps);
    } else {
      setFilteredCompetencies(allCompetencies);
      setFilteredEmployees([]);
    }
  }, [selectedJobTitle, allCompetencies, employees]);

  const downloadPDF = () => {
    const element = document.getElementById("report-content");
    if (!element) {
      toast.error("Report content not found");
      return;
    }

    const jobTitleName = selectedJobTitle
      ? jobTitles.find((j) => j.id === selectedJobTitle)?.name || "All"
      : "All";

    const opt: any = {
      margin: 10,
      filename: `Competencies_Report_${jobTitleName}_${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "landscape", unit: "mm", format: "a4" },
    };

    html2pdf().set(opt).from(element).save();
    toast.success("PDF downloaded successfully!");
  };

  const downloadExcel = () => {
    const jobTitleName = selectedJobTitle
      ? jobTitles.find((j) => j.id === selectedJobTitle)?.name || "All"
      : "All";

    // Create competencies data
    const compsData = filteredCompetencies.map((c) => ({
      "Competency": c.name,
      "Description": c.description || "",
      "Job Title": jobTitles.find((j) => j.id === c.jobTitleId)?.name || "",
    }));

    // Create employees data
    const empsData = filteredEmployees.map((e) => ({
      "Employee Name": e.fullName,
      "Email": e.email,
      "Job Title": e.jobTitle?.name || "",
      "Role": e.roles[0]?.role ?? "employee",
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Add competencies sheet
    const compsSheet = XLSX.utils.json_to_sheet(compsData);
    compsSheet["!cols"] = [{ wch: 25 }, { wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, compsSheet, "Competencies");

    // Add employees sheet if filtered by job title
    if (selectedJobTitle && empsData.length > 0) {
      const empsSheet = XLSX.utils.json_to_sheet(empsData);
      empsSheet["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, empsSheet, "Employees");
    }

    XLSX.writeFile(
      workbook,
      `Competencies_Report_${jobTitleName}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("Excel file downloaded successfully!");
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading report...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Competencies Report"
        subtitle="View all competencies with filtering by job title."
        action={
          <div className="flex gap-2">
            <Button
              onClick={downloadPDF}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <FileText className="size-4 mr-1" /> PDF
            </Button>
            <Button
              onClick={downloadExcel}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Sheet className="size-4 mr-1" /> Excel
            </Button>
          </div>
        }
      />

      <div id="report-content" className="space-y-4">
        {/* Filter */}
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium">Filter by Job Title</label>
            <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="All job titles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Competencies</SelectItem>
                {jobTitles.map((jt) => (
                  <SelectItem key={jt.id} value={jt.id}>
                    {jt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Competencies Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Competencies{" "}
              {selectedJobTitle
                ? `for ${jobTitles.find((j) => j.id === selectedJobTitle)?.name}`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCompetencies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competency</TableHead>
                    <TableHead>Description</TableHead>
                    {!selectedJobTitle && <TableHead>Job Title</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompetencies.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {comp.description || "—"}
                      </TableCell>
                      {!selectedJobTitle && (
                        <TableCell className="text-sm">
                          {jobTitles.find((j) => j.id === comp.jobTitleId)?.name || "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                No competencies found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employees Table - only show when job title is filtered */}
        {selectedJobTitle && (
          <Card>
            <CardHeader>
              <CardTitle>
                Employees with {jobTitles.find((j) => j.id === selectedJobTitle)?.name} (
                {filteredEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredEmployees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell className="capitalize">
                          {emp.roles[0]?.role ?? "employee"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  No employees with this job title.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {selectedJobTitle && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">Total Competencies</div>
                  <div className="text-2xl font-bold">{filteredCompetencies.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">Employees</div>
                  <div className="text-2xl font-bold">{filteredEmployees.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
