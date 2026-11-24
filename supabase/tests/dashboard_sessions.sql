-- Sign in once as the two test accounts before running. All changes below are rolled back.
begin;
select set_config('dashboard_test.admin', (
  select jsonb_build_object('sub', u.id, 'session_id', s.id, 'role', 'authenticated')::text
  from public.dashboard_users u join auth.sessions s on s.user_id = u.id
  where u.login_id = '2308561040' order by s.created_at desc limit 1
), true);
select set_config('dashboard_test.member', (
  select jsonb_build_object('sub', u.id, 'session_id', s.id, 'role', 'authenticated')::text
  from public.dashboard_users u join auth.sessions s on s.user_id = u.id
  where u.login_id = '2308561131' order by s.created_at desc limit 1
), true);
select set_config('request.jwt.claims', current_setting('dashboard_test.member'), true);
set local role authenticated;
do $$
begin
  if public.dashboard_session_identity()->>'state' is distinct from 'open' then raise exception 'Member session did not open'; end if;
  begin
    perform public.dashboard_kick_member(auth.uid());
    raise exception 'Member can kick';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.dashboard_sessions set ended_at = null, end_reason = null;
    raise exception 'Member can write session rows';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', current_setting('dashboard_test.admin'), true);
set local role authenticated;
do $$
declare member_key uuid := (current_setting('dashboard_test.member')::jsonb->>'sub')::uuid;
begin
  if public.dashboard_session_identity()->>'state' is distinct from 'open' then raise exception 'Admin session did not open'; end if;
  begin
    perform public.dashboard_kick_member(auth.uid());
    raise exception 'Admin can kick another super admin';
  exception when invalid_parameter_value then null;
  end;
  perform public.dashboard_kick_member(member_key);
  if exists(select 1 from public.dashboard_sessions where user_id = member_key and ended_at is null) then raise exception 'Member session remains open'; end if;
  if not exists(select 1 from public.dashboard_access_log where target_id = member_key and action = 'session_kicked') then raise exception 'Kick audit missing'; end if;
  if not (select active from public.dashboard_users where id = member_key) then raise exception 'Kick disabled the account'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims', current_setting('dashboard_test.member'), true);
set local role authenticated;
do $$
begin
  if public.dashboard_session_identity()->>'state' is distinct from 'kicked' then raise exception 'Kicked session not denied'; end if;
  if public.dashboard_session_identity()->>'state' is distinct from 'kicked' then raise exception 'Heartbeat resurrected kicked session'; end if;
  if dashboard_private.session_is_open() then raise exception 'Kicked token still authorized'; end if;
end;
$$;
reset role;
-- Sessions which had not sent a dashboard heartbeat must also be tombstoned.
do $$
begin
  if exists(select 1 from auth.sessions a left join public.dashboard_sessions d on d.id = a.id
      where a.user_id = (current_setting('dashboard_test.member')::jsonb->>'sub')::uuid
      and (d.id is null or d.end_reason <> 'kick')) then raise exception 'Unregistered Auth session bypasses kick'; end if;
end;
$$;
select set_config('request.jwt.claims', current_setting('dashboard_test.admin'), true);
set local role authenticated;
do $$
begin
  perform public.dashboard_end_session();
  if public.dashboard_session_identity()->>'state' is distinct from 'expired' then raise exception 'Logged out session reopened'; end if;
  if dashboard_private.is_super_admin() then raise exception 'Ended admin session retains privilege'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: heartbeat, member kick rejection, protected admins, all-session tombstones, no resurrection, audit, account remains active, logout revocation' as result;
