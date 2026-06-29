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
import { Download, Target } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/hr/competencies")({
  ssr: false,
  component: HrCompetenciesPage,
});

interface JobTitle {
  id: string;
  name: string;
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

function HrCompetenciesPage() {
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [filteredCompetencies, setFilteredCompetencies] = useState<Competency[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jts, comps, emps] = await Promise.all([
        api.get<JobTitle[]>("/api/job-titles"),
        api.get<Competency[]>("/api/competencies"),
        api.get<Employee[]>("/api/employees"),
      ]);
      setJobTitles(jts);
      setCompetencies(comps);
      setEmployees(emps);
      if (jts.length > 0 && !selectedJobTitle) {
        setSelectedJobTitle(jts[0].id);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load data");
    }
  };

  useEffect(() => {
    if (selectedJobTitle) {
      // Filter competencies for selected job title
      const comps = competencies.filter((c) => c.jobTitleId === selectedJobTitle);
      setFilteredCompetencies(comps);

      // Filter employees with selected job title
      const emps = employees.filter((e) => e.jobTitle?.id === selectedJobTitle);
      setFilteredEmployees(emps);
    } else {
      setFilteredCompetencies([]);
      setFilteredEmployees([]);
    }
  }, [selectedJobTitle, competencies, employees]);

  const downloadExcel = () => {
    const jobTitleName = jobTitles.find((j) => j.id === selectedJobTitle)?.name || "Competencies";

    // Create competencies sheet
    const compsData = filteredCompetencies.map((c) => ({
      "Competency": c.name,
      "Description": c.description || "",
    }));

    const compsSheet = XLSX.utils.json_to_sheet(compsData);
    compsSheet["!cols"] = [{ wch: 25 }, { wch: 35 }];

    // Create employees sheet
    const empsData = filteredEmployees.map((e) => ({
      "Employee Name": e.fullName,
      "Email": e.email,
      "Role": e.roles[0]?.role ?? "employee",
    }));

    const empsSheet = XLSX.utils.json_to_sheet(empsData);
    empsSheet["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }];

    // Create workbook with both sheets
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, compsSheet, "Competencies");
    XLSX.utils.book_append_sheet(workbook, empsSheet, "Employees");

    XLSX.writeFile(
      workbook,
      `${jobTitleName}_Competencies_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("Excel file downloaded!");
  };

  const selectedJobTitleName = jobTitles.find((j) => j.id === selectedJobTitle)?.name;

  return (
    <div>
      <PageHeader
        title="Competencies by Job Title"
        subtitle="View competencies and employees for each job title."
        action={
          selectedJobTitle && (
            <Button
              onClick={downloadExcel}
              className="bg-accent text-accent-foreground"
            >
              <Download className="size-4 mr-1" /> Excel
            </Button>
          )
        }
      />

      {jobTitles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Create a job title first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Filter */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium">Select Job Title</label>
              <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>
                      {jt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedJobTitle && (
            <>
              {/* Competencies */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-5" />
                    Competencies for {selectedJobTitleName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredCompetencies.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Competency</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompetencies.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {c.description || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No competencies for this job title yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Employees */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Employees with {selectedJobTitleName} ({filteredEmployees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                        {filteredEmployees.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.fullName}</TableCell>
                            <TableCell className="text-muted-foreground">{e.email}</TableCell>
                            <TableCell className="capitalize">
                              {e.roles[0]?.role ?? "employee"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No employees with this job title yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
