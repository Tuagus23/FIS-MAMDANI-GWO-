-- Version matches the applied hosted migration; activity remains protected by existing session RLS.
alter table public.dashboard_sessions
  add column started_at timestamptz not null default clock_timestamp(),
  add column current_page text check (current_page in ('/', '/validasi', '/membership', '/gwo', '/fis', '/simulasi', '/anggota', '/motto', '/pengguna'));

update public.dashboard_sessions as dashboard
set started_at = auth_session.created_at
from auth.sessions as auth_session
where dashboard.id = auth_session.id and auth_session.created_at is not null;

create function dashboard_private.session_presence(page_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  identity jsonb;
begin
  if page_path is null or page_path not in ('/', '/validasi', '/membership', '/gwo', '/fis', '/simulasi', '/anggota', '/motto', '/pengguna') then
    raise exception 'Halaman dashboard tidak valid.' using errcode = '22023';
  end if;
  identity := dashboard_private.session_identity();
  if identity->>'state' = 'open' then
    update public.dashboard_sessions as dashboard
    set current_page = page_path,
        started_at = coalesce((select created_at from auth.sessions where id = dashboard.id and user_id = auth.uid()), dashboard.started_at)
    where dashboard.id = nullif(auth.jwt()->>'session_id', '')::uuid
      and dashboard.user_id = (select auth.uid()) and dashboard.ended_at is null;
  end if;
  return identity;
end;
$$;
revoke all on function dashboard_private.session_presence(text) from public, anon;
grant execute on function dashboard_private.session_presence(text) to authenticated;

create function public.dashboard_session_presence(page_path text)
returns jsonb language sql security invoker set search_path = ''
as $$ select dashboard_private.session_presence(page_path); $$;
revoke all on function public.dashboard_session_presence(text) from public, anon;
grant execute on function public.dashboard_session_presence(text) to authenticated;

notify pgrst, 'reload schema';
