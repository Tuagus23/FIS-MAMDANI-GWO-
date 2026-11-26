alter table public.dashboard_sessions
  drop constraint dashboard_sessions_current_page_check,
  add constraint dashboard_sessions_current_page_check
    check (current_page in ('/', '/dasar-proyek', '/validasi', '/membership', '/gwo', '/fis', '/simulasi', '/anggota', '/motto', '/pengguna'));

create or replace function dashboard_private.session_presence(page_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  identity jsonb;
begin
  if page_path is null or page_path not in ('/', '/dasar-proyek', '/validasi', '/membership', '/gwo', '/fis', '/simulasi', '/anggota', '/motto', '/pengguna') then
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
