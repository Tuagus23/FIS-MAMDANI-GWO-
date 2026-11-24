create schema if not exists dashboard_private;
revoke all on schema dashboard_private from public, anon;
grant usage on schema dashboard_private to authenticated;

create table public.dashboard_users (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  role text not null default 'member' check (role in ('member', 'super_admin')),
  active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp()
);

create table public.dashboard_access_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.dashboard_users(id),
  target_id uuid not null references public.dashboard_users(id),
  old_role text not null,
  new_role text not null,
  old_active boolean not null,
  new_active boolean not null,
  created_at timestamptz not null default clock_timestamp()
);
create index dashboard_access_log_actor_idx on public.dashboard_access_log(actor_id);
create index dashboard_access_log_target_idx on public.dashboard_access_log(target_id);
create index dashboard_access_log_created_idx on public.dashboard_access_log(created_at desc);

alter table public.dashboard_users enable row level security;
alter table public.dashboard_access_log enable row level security;
revoke all on public.dashboard_users, public.dashboard_access_log from anon, authenticated;
grant select on public.dashboard_users, public.dashboard_access_log to authenticated;

create function dashboard_private.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.dashboard_users
    where id = (select auth.uid()) and role = 'super_admin' and active
  );
$$;
revoke all on function dashboard_private.is_super_admin() from public, anon;
grant execute on function dashboard_private.is_super_admin() to authenticated;

create policy dashboard_read_identity on public.dashboard_users
for select to authenticated
using (id = (select auth.uid()) or (select dashboard_private.is_super_admin()));
create policy dashboard_admin_read_log on public.dashboard_access_log
for select to authenticated
using ((select dashboard_private.is_super_admin()));

create function public.dashboard_update_user(
  target_user_id uuid,
  new_role text,
  new_active boolean,
  expected_updated_at timestamptz
)
returns public.dashboard_users
language plpgsql security definer set search_path = ''
as $$
declare
  previous public.dashboard_users;
  updated public.dashboard_users;
begin
  -- Serialize role changes so concurrent requests cannot remove the last admin.
  perform pg_catalog.pg_advisory_xact_lock(250112503);
  if not dashboard_private.is_super_admin() then
    raise exception 'Hanya super admin yang dapat mengelola pengguna.' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('member', 'super_admin') or new_active is null then
    raise exception 'Peran atau status akun tidak valid.' using errcode = '22023';
  end if;
  select * into previous from public.dashboard_users where id = target_user_id for update;
  if not found then
    raise exception 'Pengguna tidak ditemukan.' using errcode = 'P0002';
  end if;
  if expected_updated_at is null or previous.updated_at <> expected_updated_at then
    raise exception 'Akun telah diubah admin lain. Muat ulang sebelum menyimpan.' using errcode = '40001';
  end if;
  if target_user_id = (select auth.uid()) and (new_role <> 'super_admin' or not new_active) then
    raise exception 'Peran dan akses akun sendiri harus tetap aktif sebagai super admin.' using errcode = '22023';
  end if;
  if previous.role = 'super_admin' and previous.active and (new_role <> 'super_admin' or not new_active)
     and (select count(*) from public.dashboard_users where role = 'super_admin' and active) <= 1 then
    raise exception 'Minimal satu super admin harus tetap aktif.' using errcode = '22023';
  end if;
  if previous.role = new_role and previous.active = new_active then
    return previous;
  end if;
  update public.dashboard_users
  set role = new_role, active = new_active, updated_at = clock_timestamp()
  where id = target_user_id returning * into updated;
  insert into public.dashboard_access_log(actor_id, target_id, old_role, new_role, old_active, new_active)
  values ((select auth.uid()), target_user_id, previous.role, new_role, previous.active, new_active);
  return updated;
end;
$$;
revoke all on function public.dashboard_update_user(uuid, text, boolean, timestamptz) from public, anon;
grant execute on function public.dashboard_update_user(uuid, text, boolean, timestamptz) to authenticated;

-- Bootstrap the existing, previously authorized accounts, independent of editable Auth metadata.
insert into public.dashboard_users(id, login_id, role)
select id, split_part(email, '@', 1),
  case when split_part(email, '@', 1) in ('2308561040', '2308561134', '2308561016', '2308561124', 'supriana')
    then 'super_admin' else 'member' end
from auth.users
where email like '%@auth.fuzzy-ch-wsn-dashboard.vercel.app'
   or email = 'tuagus.baluk@gmail.com';
