
-- Tighten profiles SELECT to owner-only (admins keep separate policy)
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Restrict quizzes SELECT to admins only. The game reads quizzes through
-- server functions that now use the service-role client (RLS bypassed).
DROP POLICY IF EXISTS "Authenticated can view quizzes" ON public.quizzes;
CREATE POLICY "Admins can view quizzes"
  ON public.quizzes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- gold_packages: catalog data only used server-side by the Paddle webhook
-- (service role bypasses RLS). Add an admin-only SELECT policy so the
-- linter no longer reports "RLS enabled, no policy".
CREATE POLICY "Admins can view gold packages"
  ON public.gold_packages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
