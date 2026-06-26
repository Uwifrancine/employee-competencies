
-- HR helper
CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'hr')
$$;
GRANT EXECUTE ON FUNCTION public.is_hr(uuid) TO authenticated, anon;

-- Profiles
DROP POLICY IF EXISTS "view own profile" ON public.profiles;
CREATE POLICY "view profiles" ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.is_supervisor_of(auth.uid(), id)
);
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update profiles" ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP POLICY IF EXISTS "admins insert profiles" ON public.profiles;
CREATE POLICY "admins or hr insert profiles" ON public.profiles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR id = auth.uid());

-- user_roles admin management
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Job titles + competencies
DROP POLICY IF EXISTS "admins manage job titles" ON public.job_titles;
CREATE POLICY "admins or hr manage job titles" ON public.job_titles FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP POLICY IF EXISTS "admins manage competencies" ON public.competencies;
CREATE POLICY "admins or hr manage competencies" ON public.competencies FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Quizzes
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quiz_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assignments TO authenticated;
GRANT ALL ON public.quiz_assignments TO service_role;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view quizzes" ON public.quizzes FOR SELECT USING (
  supervisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.quiz_id = quizzes.id AND qa.employee_id = auth.uid())
);
CREATE POLICY "supervisor manages own quizzes" ON public.quizzes FOR ALL
USING (supervisor_id = auth.uid()) WITH CHECK (supervisor_id = auth.uid());
CREATE TRIGGER set_quizzes_updated BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view questions of viewable quizzes" ON public.quiz_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND (
    q.supervisor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.quiz_id = q.id AND qa.employee_id = auth.uid())
  ))
);
CREATE POLICY "owner manages questions" ON public.quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND q.supervisor_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND q.supervisor_id = auth.uid())
);

CREATE TABLE public.quiz_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_choices TO authenticated;
GRANT ALL ON public.quiz_choices TO service_role;
ALTER TABLE public.quiz_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view choices" ON public.quiz_choices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = quiz_choices.question_id AND (
      q.supervisor_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'hr')
      OR EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.quiz_id = q.id AND qa.employee_id = auth.uid())
    )
  )
);
CREATE POLICY "owner manages choices" ON public.quiz_choices FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = quiz_choices.question_id AND q.supervisor_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = quiz_choices.question_id AND q.supervisor_id = auth.uid()
  )
);

CREATE POLICY "view related assignments" ON public.quiz_assignments FOR SELECT USING (
  employee_id = auth.uid()
  OR assigned_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_assignments.quiz_id AND q.supervisor_id = auth.uid())
);
CREATE POLICY "supervisor assigns" ON public.quiz_assignments FOR INSERT WITH CHECK (
  assigned_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_assignments.quiz_id AND q.supervisor_id = auth.uid())
  AND public.is_supervisor_of(auth.uid(), employee_id)
);
CREATE POLICY "supervisor deletes assignments" ON public.quiz_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_assignments.quiz_id AND q.supervisor_id = auth.uid())
);
CREATE POLICY "employee updates own assignment" ON public.quiz_assignments FOR UPDATE
USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.quiz_assignments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_pct numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view related attempts" ON public.quiz_attempts FOR SELECT USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR EXISTS (
    SELECT 1 FROM public.quiz_assignments qa JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.id = quiz_attempts.assignment_id AND q.supervisor_id = auth.uid()
  )
);
CREATE POLICY "employee inserts own attempt" ON public.quiz_attempts FOR INSERT WITH CHECK (
  employee_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.id = quiz_attempts.assignment_id AND qa.employee_id = auth.uid())
);

CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  choice_id uuid REFERENCES public.quiz_choices(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view answers" ON public.quiz_answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.quiz_attempts at WHERE at.id = quiz_answers.attempt_id AND (
      at.employee_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'hr')
      OR EXISTS (
        SELECT 1 FROM public.quiz_assignments qa JOIN public.quizzes q ON q.id = qa.quiz_id
        WHERE qa.id = at.assignment_id AND q.supervisor_id = auth.uid()
      )
    )
  )
);
CREATE POLICY "employee inserts own answers" ON public.quiz_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_attempts at WHERE at.id = quiz_answers.attempt_id AND at.employee_id = auth.uid())
);
