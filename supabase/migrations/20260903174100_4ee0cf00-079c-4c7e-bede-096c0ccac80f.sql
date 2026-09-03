REVOKE ALL ON FUNCTION public.claim_story_reward(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_story_reward(text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_story_reward(text, text, uuid) TO authenticated;
