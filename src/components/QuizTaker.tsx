import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

interface Question {
  id: string;
  prompt: string;
  questionType: "multipleChoice" | "checkbox" | "select";
  choices: {
    id: string;
    text: string;
    isCorrect: boolean;
    orderIndex: number;
  }[];
}

interface QuizTakerProps {
  assignmentId: string;
  quizTitle: string;
  quizDescription: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

export function QuizTaker({
  assignmentId,
  quizTitle,
  quizDescription,
  onComplete,
  onCancel,
}: QuizTakerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [assignmentId]);

  const loadQuiz = async () => {
    try {
      const assignment = await api.get<any>(`/api/quiz-assignments/${assignmentId}`);
      setQuestions(assignment.quiz.questions || []);
      const initialAnswers: Record<string, string[]> = {};
      assignment.quiz.questions?.forEach((q: Question) => {
        initialAnswers[q.id] = [];
      });
      setAnswers(initialAnswers);
    } catch (e: any) {
      toast.error("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleChoiceChange = (choiceId: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[currentQuestion.id] || [];
      if (currentQuestion.questionType === "checkbox") {
        return {
          ...prev,
          [currentQuestion.id]: checked
            ? [...current, choiceId]
            : current.filter((id) => id !== choiceId),
        };
      } else {
        return {
          ...prev,
          [currentQuestion.id]: checked ? [choiceId] : [],
        };
      }
    });
  };

  const submitQuiz = async () => {
    setSubmitting(true);
    try {
      const answerArray = questions.map((q) => ({
        questionId: q.id,
        choiceIds: answers[q.id] || [],
      }));

      const result = await api.post<any>(
        `/api/quiz-assignments/${assignmentId}/attempt`,
        { answers: answerArray }
      );

      setScore(Math.round(result.scorePct));
      setCompleted(true);
      toast.success(`Quiz completed! Score: ${Math.round(result.scorePct)}%`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-accent/50 bg-accent/5">
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading quiz...
        </CardContent>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card className="border-accent/50 bg-accent/5">
        <CardContent className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="size-12 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{score}%</div>
            <div className="text-sm text-muted-foreground mt-2">
              Quiz completed successfully!
            </div>
          </div>
          <Button onClick={onComplete} className="w-full bg-accent text-accent-foreground">
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/50 bg-accent/5">
      <CardHeader className="pb-4">
        <div className="space-y-2">
          <CardTitle className="text-lg">{quizTitle}</CardTitle>
          {quizDescription && (
            <p className="text-sm text-muted-foreground">{quizDescription}</p>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Question {currentStep + 1} of {questions.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Question */}
        <div className="space-y-4">
          <div className="text-base font-medium">{currentQuestion.prompt}</div>

          {/* Choices */}
          <div className="space-y-2">
            {currentQuestion.choices.map((choice) => {
              const isSelected = answers[currentQuestion.id]?.includes(choice.id);
              const isMultiple = currentQuestion.questionType === "checkbox";

              return (
                <label
                  key={choice.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent cursor-pointer transition"
                >
                  <input
                    type={isMultiple ? "checkbox" : "radio"}
                    name={currentQuestion.id}
                    checked={isSelected}
                    onChange={(e) => handleChoiceChange(choice.id, e.target.checked)}
                    className="size-4"
                  />
                  <span className="text-sm flex-1">{choice.text}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="size-4 mr-1" /> Previous
          </Button>

          {currentStep === questions.length - 1 ? (
            <Button
              onClick={submitQuiz}
              disabled={submitting}
              className="flex-1 bg-accent text-accent-foreground"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex-1 bg-accent text-accent-foreground"
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          )}

          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
