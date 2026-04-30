-- profiles: 관리자 전체 조회 허용 (기존 정책은 그대로 유지)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- scanned_cards: 관리자 전체 조회/수정/삭제 허용
CREATE POLICY "Admins can view all scanned cards"
ON public.scanned_cards
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any scanned card"
ON public.scanned_cards
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any scanned card"
ON public.scanned_cards
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));