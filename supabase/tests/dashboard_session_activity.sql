-- Run inside a transaction; the caller rolls back all fixture sessions.
select set_config('dashboard_test.member', (
  select jsonb_build_object('sub', id, 'session_id', gen_random_uuid(), 'role', 'authenticated')::text
  from public.dashboard_users where login_id = '2308561131'
), true);
insert into auth.sessions(id, user_id, created_at, updated_at)
select (current_setting('dashboard_test.member')::jsonb->>'session_id')::uuid,
       (current_setting('dashboard_test.member')::jsonb->>'sub')::uuid,
       clock_timestamp() - interval '10 minutes', clock_timestamp();
select set_config('request.jwt.claims', current_setting('dashboard_test.member'), true);
set local role authenticated;
do $$
begin
  if public.dashboard_session_presence('/fis')->>'state' is distinct from 'open' then raise exception 'Valid presence failed'; end if;
  if exists(select 1 from public.dashboard_sessions) then raise exception 'Member can read private session activity'; end if;
  begin
    perform public.dashboard_session_presence('/outside?private=value');
    raise exception 'Arbitrary URL was accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
do $$
declare fixture public.dashboard_sessions;
begin
  select * into fixture from public.dashboard_sessions where id = (current_setting('dashboard_test.member')::jsonb->>'session_id')::uuid;
  if fixture.current_page is distinct from '/fis' then raise exception 'Current page not stored'; end if;
  if fixture.started_at > clock_timestamp() - interval '9 minutes' then raise exception 'Start time does not use Auth session'; end if;
end;
$$;
set local role authenticated;
do $$
begin
  perform public.dashboard_end_session();
  if public.dashboard_session_presence('/gwo')->>'state' is distinct from 'expired' then raise exception 'Presence revived ended session'; end if;
end;
$$;
reset role;
do $$
begin
  if (select current_page from public.dashboard_sessions where id = (current_setting('dashboard_test.member')::jsonb->>'session_id')::uuid) is distinct from '/fis' then raise exception 'Ended session changed page'; end if;
  if has_function_privilege('anon', 'public.dashboard_session_presence(text)', 'execute') then raise exception 'Anonymous presence is exposed'; end if;
end;
$$;
