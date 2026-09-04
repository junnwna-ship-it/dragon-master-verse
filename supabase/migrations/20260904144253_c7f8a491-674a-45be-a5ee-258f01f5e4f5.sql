REVOKE EXECUTE ON FUNCTION public.claim_quiz_reward(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_quiz_reward(integer) TO authenticated, service_role;