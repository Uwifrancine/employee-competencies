import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor/competencies")({
  ssr: false,
  component: SupervisorCompetenciesPage,
});

interface Employee {
  id: string;
  fullName: string;
  email: string;
  jobTitle: { id: string; name: string } | null;
}

interface Competency {
  id: string;
  name: string;
  description: string | null;
  jobTitleId: string;
}

interface JobTitle {
  id: string;
  name: string;
}

function SupervisorCompetenciesPage() {
  const [team, setTeam] = useState<Employee[]>([]);
  const [competencies, setCompetencies] = useState<Record<string, Competency[]>>({});
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCompetencyId, setDeletingCompetencyId] = useState<string | null>(null);
  const [compName, setCompName] = useState("");
  const [compDesc, setCompDesc] = useState("");

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const employees = await api.get<Employee[]>("/api/employees");
      setTeam(employees);

      // Load competencies for each job title
      const compsMap: Record<string, Competency[]> = {};
      const jobTitleIds = [
        ...new Set(employees.map((e) => e.jobTitle?.id).filter(Boolean)),
      ] as string[];

      for (const jtId of jobTitleIds) {
        const comps = await api.get<Competency[]>(`/api/competencies?jobTitleId=${jtId}`);
        compsMap[jtId] = comps;
      }
      setCompetencies(compsMap);

      // Auto-select first job title
      if (jobTitleIds.length > 0 && !selectedJobTitleId) {
        setSelectedJobTitleId(jobTitleIds[0]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load team");
    }
  };

  const addCompetency = async () => {
    if (!compName.trim() || !selectedJobTitleId) return toast.error("Competency name required");
    try {
      await api.post("/api/competencies", {
        name: compName.trim(),
        description: compDesc.trim() || null,
        jobTitleId: selectedJobTitleId,
      });
      toast.success("Setting added successfully");
      setCompName("");
      setCompDesc("");
      setOpenDialog(false);
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add setting");
    }
  };

  const deleteCompetency = async () => {
    if (!deletingCompetencyId) return;
    try {
      await api.delete(`/api/competencies/${deletingCompetencyId}`);
      toast.success("Competency deleted");
      setDeleteDialogOpen(false);
      setDeletingCompetencyId(null);
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const jobTitles: JobTitle[] = [
    ...new Set(team.map((e) => e.jobTitle).filter(Boolean)),
  ] as JobTitle[];

  const selectedJobTitle = jobTitles.find((j) => j.id === selectedJobTitleId);
  const teamMembers = selectedJobTitle
    ? team.filter((e) => e.jobTitle?.id === selectedJobTitleId)
    : [];
  const comps = selectedJobTitleId ? competencies[selectedJobTitleId] || [] : [];

  return (
    <div>
      <PageHeader
        title="List Of Competencies"
        subtitle="Manage competencies and settings for your team's job titles."
      />

      {team.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No team members yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-[250px_1fr]">
          {/* Left Sidebar - Job Titles */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Job Titles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {jobTitles.map((jt) => {
                  const count = team.filter((e) => e.jobTitle?.id === jt.id).length;
                  const isSelected = selectedJobTitleId === jt.id;
                  return (
                    <button
                      key={jt.id}
                      onClick={() => setSelectedJobTitleId(jt.id)}
                      className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                    >
                      <div className="font-medium text-sm">{jt.name}</div>
                      <div
                        className={`text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {count} member{count !== 1 ? "s" : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Main Area */}
          {selectedJobTitle && (
            <div className="space-y-4">
              {/* Job Title Header */}
              <div className="mb-2">
                <h2 className="text-2xl font-bold">{selectedJobTitle.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Managing competencies for {teamMembers.length} team member
                  {teamMembers.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Team Members Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  {teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                        >
                          <div className="size-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{member.fullName}</div>
                            <div className="text-xs text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No team members with this job title.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Competencies Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">List Of Competencies</CardTitle>
                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-accent text-accent-foreground">
                          <Plus className="size-3 mr-1" /> Create Competency
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Competency to {selectedJobTitle.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label>Setting name</Label>
                            <Input
                              value={compName}
                              onChange={(e) => setCompName(e.target.value)}
                              placeholder="e.g., Problem Solving"
                            />
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={compDesc}
                              onChange={(e) => setCompDesc(e.target.value)}
                              placeholder="Optional description..."
                            />
                          </div>
                          <Button
                            onClick={addCompetency}
                            className="bg-accent text-accent-foreground w-full"
                          >
                            Create Setting
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {comps.length > 0 ? (
                    <div className="space-y-2">
                      {comps.map((comp) => (
                        <div
                          key={comp.id}
                          className="flex items-start justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex-1 pr-3">
                            <div className="font-medium text-sm">{comp.name}</div>
                            {comp.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {comp.description}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setDeletingCompetencyId(comp.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No settings yet. Click "Create Competency" to create one.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-xs text-muted-foreground mb-1">Team Members</div>
                      <div className="text-2xl font-bold">{teamMembers.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-xs text-muted-foreground mb-1">Competencies</div>
                      <div className="text-2xl font-bold">{comps.length}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Competency?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this competency? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingCompetencyId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteCompetency}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
