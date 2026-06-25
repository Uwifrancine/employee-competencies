
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.evaluator_type AS ENUM ('self', 'supervisor');
CREATE TYPE public.dev_plan_status AS ENUM ('open', 'in_progress', 'completed');

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users can view their roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ job_titles ============
CREATE TABLE public.job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_titles TO authenticated;
GRANT ALL ON public.job_titles TO service_role;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in can read job titles" ON public.job_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage job titles" ON public.job_titles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title_id UUID REFERENCES public.job_titles(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_id UUID, _employee_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _employee_id AND supervisor_id = _supervisor_id)
$$;

CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR supervisor_id = auth.uid());

CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============ competencies ============
CREATE TABLE public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id UUID NOT NULL REFERENCES public.job_titles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competencies TO authenticated;
GRANT ALL ON public.competencies TO service_role;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in reads competencies" ON public.competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage competencies" ON public.competencies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ evaluations ============
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_type public.evaluator_type NOT NULL,
  job_title_id UUID NOT NULL REFERENCES public.job_titles(id) ON DELETE RESTRICT,
  overall_percent NUMERIC(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view related evaluations" ON public.evaluations FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR evaluator_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_supervisor_of(auth.uid(), employee_id)
);

CREATE POLICY "self insert self eval" ON public.evaluations FOR INSERT TO authenticated
WITH CHECK (
  (evaluator_type = 'self' AND evaluator_id = auth.uid() AND employee_id = auth.uid())
  OR (evaluator_type = 'supervisor' AND evaluator_id = auth.uid() AND public.is_supervisor_of(auth.uid(), employee_id))
);

-- ============ evaluation_scores ============
CREATE TABLE public.evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE RESTRICT,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
  UNIQUE (evaluation_id, competency_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_scores TO authenticated;
GRANT ALL ON public.evaluation_scores TO service_role;
ALTER TABLE public.evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view scores of viewable evaluations" ON public.evaluation_scores FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND (
  e.employee_id = auth.uid() OR e.evaluator_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_supervisor_of(auth.uid(), e.employee_id)
)));

CREATE POLICY "insert scores for own evaluations" ON public.evaluation_scores FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND e.evaluator_id = auth.uid()));

-- ============ development_plans ============
CREATE TABLE public.development_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status public.dev_plan_status NOT NULL DEFAULT 'open',
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.development_plans TO authenticated;
GRANT ALL ON public.development_plans TO service_role;
ALTER TABLE public.development_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view related plans" ON public.development_plans FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "supervisors create plans for reports" ON public.development_plans FOR INSERT TO authenticated
WITH CHECK (
  supervisor_id = auth.uid() AND public.is_supervisor_of(auth.uid(), employee_id)
);

CREATE POLICY "supervisors update their plans" ON public.development_plans FOR UPDATE TO authenticated
USING (supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "supervisors delete their plans" ON public.development_plans FOR DELETE TO authenticated
USING (supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ dev_plan_items ============
CREATE TABLE public.dev_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.development_plans(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  due_date DATE,
  status public.dev_plan_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dev_plan_items TO authenticated;
GRANT ALL ON public.dev_plan_items TO service_role;
ALTER TABLE public.dev_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view items of viewable plans" ON public.dev_plan_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.development_plans p WHERE p.id = plan_id AND (
  p.employee_id = auth.uid() OR p.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
)));

CREATE POLICY "supervisors manage items" ON public.dev_plan_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.development_plans p WHERE p.id = plan_id AND (p.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.development_plans p WHERE p.id = plan_id AND (p.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_set_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER plans_set_updated BEFORE UPDATE ON public.development_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
