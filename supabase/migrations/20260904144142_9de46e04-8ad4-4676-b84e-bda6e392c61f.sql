UPDATE public.dragon_pool p SET rarity = 'legendary', weight = 2, shard_cost = 120
 WHERE p.dragon_id = (SELECT id FROM public.dragons WHERE name = 'Caminont' LIMIT 1);

UPDATE public.dragon_pool p SET rarity = 'epic', weight = 8, shard_cost = 80
 WHERE p.dragon_id = (SELECT id FROM public.dragons WHERE name = 'Bella' LIMIT 1);

UPDATE public.dragon_pool p SET rarity = 'rare', weight = 10, shard_cost = 45
 WHERE p.dragon_id IN (SELECT id FROM public.dragons WHERE name IN ('Spike','Younigon','Puri'));

UPDATE public.dragon_pool p SET rarity = 'common', weight = 15, shard_cost = 20
 WHERE p.dragon_id IN (SELECT id FROM public.dragons WHERE name IN ('Comi','Elia','Worm','Snowy'));