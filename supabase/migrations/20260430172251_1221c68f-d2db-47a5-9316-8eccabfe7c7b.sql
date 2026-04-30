-- 282ptpt@naver.com 계정에 admin 역할 부여
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = '282ptpt@naver.com'
ON CONFLICT (user_id, role) DO NOTHING;