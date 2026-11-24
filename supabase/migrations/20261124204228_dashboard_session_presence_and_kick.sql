create table public.dashboard_sessions (
  id uuid primary key,
  user_id uuid not null references public.dashboard_users(id) on delete cascade,
  last_seen_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('logout', 'kick')),
  check ((ended_at is null) = (end_reason is null))
);
create index dashboard_sessions_user_idx on public.dashboard_sessions(user_id);
create index dashboard_sessions_presence_idx on public.dashboard_sessions(last_seen_at) where ended_at is null;
alter table public.dashboard_sessions enable row level security;
revoke all on public.dashboard_sessions from public, anon, authenticated;
grant select on public.dashboard_sessions to authenticated;

create function dashboard_private.session_is_open()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions
    where id = nullif(auth.jwt()->>'session_id', '')::uuid and user_id = (select auth.uid())
  ) and not exists (
    select 1 from public.dashboard_sessions
    where id = nullif(auth.jwt()->>'session_id', '')::uuid and ended_at is not null
  );
$$;
revoke all on function dashboard_private.session_is_open() from public, anon;
grant execute on function dashboard_private.session_is_open() to authenticated;

create or replace function dashboard_private.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select dashboard_private.session_is_open() and exists (
    select 1 from public.dashboard_users
    where id = (select auth.uid()) and role = 'super_admin' and active
  );
$$;
create policy dashboard_admin_read_sessions on public.dashboard_sessions
for select to authenticated using ((select dashboard_private.is_super_admin()));

create function dashboard_private.session_identity()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  session_key uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  profile public.dashboard_users;
  current_session public.dashboard_sessions;
begin
  select * into profile from public.dashboard_users where id = actor for update;
  if not found or not profile.active then
    return jsonb_build_object('state', 'access_revoked');
  end if;
  select * into current_session from public.dashboard_sessions where id = session_key;
  if found and current_session.ended_at is not null then
    return jsonb_build_object('state', case when current_session.end_reason = 'kick' then 'kicked' else 'expired' end);
  end if;
  if not exists(select 1 from auth.sessions where id = session_key and user_id = actor) then
    return jsonb_build_object('state', 'expired');
  end if;
  insert into public.dashboard_sessions(id, user_id, last_seen_at)
  values (session_key, actor, clock_timestamp())
  on conflict (id) do update set last_seen_at = excluded.last_seen_at
  where public.dashboard_sessions.ended_at is null;
  return jsonb_build_object('id', actor, 'role', profile.role, 'active', profile.active, 'state', 'open');
end;
$$;
revoke all on function dashboard_private.session_identity() from public, anon;
grant execute on function dashboard_private.session_identity() to authenticated;

create function public.dashboard_session_identity()
returns jsonb language sql security invoker set search_path = ''
as $$ select dashboard_private.session_identity(); $$;
revoke all on function public.dashboard_session_identity() from public, anon;
grant execute on function public.dashboard_session_identity() to authenticated;

create function dashboard_private.end_session()
returns void language sql security definer set search_path = ''
as $$
  update public.dashboard_sessions set ended_at = clock_timestamp(), end_reason = 'logout'
  where id = nullif(auth.jwt()->>'session_id', '')::uuid and user_id = (select auth.uid()) and ended_at is null;
$$;
revoke all on function dashboard_private.end_session() from public, anon;
grant execute on function dashboard_private.end_session() to authenticated;
create function public.dashboard_end_session()
returns void language sql security invoker set search_path = ''
as $$ select dashboard_private.end_session(); $$;
revoke all on function public.dashboard_end_session() from public, anon;
grant execute on function public.dashboard_end_session() to authenticated;

alter table public.dashboard_access_log
  add column action text not null default 'access_updated' check (action in ('access_updated', 'session_kicked')),
  add column session_count integer check (session_count >= 0);

create function dashboard_private.kick_member(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  target public.dashboard_users;
  session_total integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(250112503);
  if not dashboard_private.is_super_admin() then
    raise exception 'Hanya super admin yang dapat mengeluarkan member.' using errcode = '42501';
  end if;
  select * into target from public.dashboard_users where id = target_user_id for update;
  if not found then
    raise exception 'Pengguna tidak ditemukan.' using errcode = 'P0002';
  end if;
  if target.role <> 'member' or target.id = (select auth.uid()) then
    raise exception 'Kick hanya tersedia untuk member, bukan super admin.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.dashboard_sessions where user_id = target_user_id
      and ended_at is null and last_seen_at > clock_timestamp() - interval '90 seconds') then
    raise exception 'Member ini sudah tidak login. Muat ulang daftar pengguna.' using errcode = '22023';
  end if;
  -- Tombstones cover all existing Auth sessions, including sessions not yet registered by the app.
  insert into public.dashboard_sessions(id, user_id, last_seen_at, ended_at, end_reason)
  select id, user_id, coalesce(created_at, clock_timestamp()), clock_timestamp(), 'kick'
  from auth.sessions where user_id = target_user_id
  on conflict (id) do update set ended_at = excluded.ended_at, end_reason = 'kick'
  where public.dashboard_sessions.ended_at is null;
  get diagnostics session_total = row_count;
  update public.dashboard_sessions set ended_at = clock_timestamp(), end_reason = 'kick'
  where user_id = target_user_id and ended_at is null;
  insert into public.dashboard_access_log(actor_id, target_id, old_role, new_role, old_active, new_active, action, session_count)
  values (auth.uid(), target_user_id, target.role, target.role, target.active, target.active, 'session_kicked', session_total);
  return jsonb_build_object('ended_sessions', session_total);
end;
$$;
revoke all on function dashboard_private.kick_member(uuid) from public, anon;
grant execute on function dashboard_private.kick_member(uuid) to authenticated;
create function public.dashboard_kick_member(target_user_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select dashboard_private.kick_member(target_user_id); $$;
revoke all on function public.dashboard_kick_member(uuid) from public, anon;
grant execute on function public.dashboard_kick_member(uuid) to authenticated;
