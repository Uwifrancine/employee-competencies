
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_of(UUID, UUID) FROM PUBLIC, anon, authenticated;
