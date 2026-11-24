alter function public.dashboard_update_user(uuid, text, boolean, timestamptz)
  set schema dashboard_private;

-- The exposed entry point inherits caller privileges; the private function owns the guarded transaction.
create function public.dashboard_update_user(
  target_user_id uuid,
  new_role text,
  new_active boolean,
  expected_updated_at timestamptz
)
returns public.dashboard_users
language sql security invoker set search_path = ''
as $$
  select dashboard_private.dashboard_update_user(target_user_id, new_role, new_active, expected_updated_at);
$$;
revoke all on function public.dashboard_update_user(uuid, text, boolean, timestamptz) from public, anon;
grant execute on function public.dashboard_update_user(uuid, text, boolean, timestamptz) to authenticated;
