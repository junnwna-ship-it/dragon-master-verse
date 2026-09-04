REVOKE EXECUTE ON FUNCTION public.summon_dragon(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exchange_shards(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.buy_combat_item(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_battle_item(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_quiz_reward(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_story_run(jsonb, integer) FROM anon;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_user_story_lobby_visibility() FROM PUBLIC, anon, authenticated;