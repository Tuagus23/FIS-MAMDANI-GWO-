-- Every write in this authorization test is rolled back.
begin;
select set_config('request.jwt.claims', (select jsonb_build_object('sub',u.id,'session_id',s.id,'role','authenticated')::text
  from public.dashboard_users u join auth.sessions s on s.user_id=u.id where u.login_id='2308561131' order by s.created_at desc limit 1), true);
set local role authenticated;
do $$
declare total integer;
begin
  select count(*) into total from public.dashboard_users;
  if total <> 1 then raise exception 'Member can read other accounts'; end if;
  if exists(select 1 from public.dashboard_access_log) then raise exception 'Member can read access log'; end if;
  begin
    update public.dashboard_users set role = 'super_admin' where id = auth.uid();
    raise exception 'Member can write roles directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.dashboard_update_user(auth.uid(), 'super_admin', true, now());
    raise exception 'Member can escalate via RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', (select jsonb_build_object('sub',u.id,'session_id',s.id,'role','authenticated')::text
  from public.dashboard_users u join auth.sessions s on s.user_id=u.id where u.login_id='2308561040' order by s.created_at desc limit 1), true);
set local role authenticated;
do $$
declare
  target public.dashboard_users;
  changed public.dashboard_users;
  initial_logs integer;
begin
  if (select count(*) from public.dashboard_users) <> 28 then raise exception 'Admin cannot read all 28 existing accounts'; end if;
  select * into target from public.dashboard_users where login_id = '2308561131';
  select count(*) into initial_logs from public.dashboard_access_log;
  perform public.dashboard_update_user(target.id, target.role, target.active, target.updated_at);
  if (select count(*) from public.dashboard_access_log) <> initial_logs then raise exception 'No-op created audit entry'; end if;
  select * into changed from public.dashboard_update_user(target.id, 'super_admin', false, target.updated_at);
  if changed.role <> 'super_admin' or changed.active then raise exception 'Admin update failed'; end if;
  if (select count(*) from public.dashboard_access_log) <> initial_logs + 1 then raise exception 'Audit entry missing'; end if;
  begin
    perform public.dashboard_update_user(target.id, 'member', true, target.updated_at);
    raise exception 'Stale version accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.dashboard_update_user(auth.uid(), 'member', true, (select updated_at from public.dashboard_users where id = auth.uid()));
    raise exception 'Admin can demote self';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
update public.dashboard_users set active = false where id = auth.uid();
set local role authenticated;
do $$
begin
  if dashboard_private.is_super_admin() then raise exception 'Inactive admin still has privilege'; end if;
  begin
    perform public.dashboard_update_user(auth.uid(), 'super_admin', true, now());
    raise exception 'Inactive admin can reactivate self';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
select 'PASS: member RLS, direct writes, privilege escalation, admin updates, audit, stale versions, self protection, inactive admin' as result;
