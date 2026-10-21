-- TinyFinance only. No TinyTeam schema or data is modified.
alter table public.employees add column if not exists display_name text;
create function public.import_tinyteam_times(org uuid,items jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; emp uuid; old public.time_entries; added integer:=0; skipped integer:=0; matches integer; src text;
begin
 if not public.can_edit(org) then raise exception 'Kein Schreibzugriff';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)<1 or jsonb_array_length(items)>2000 then raise exception 'Ungültiger Importumfang';end if;
 -- Serialize all imports for the organization, including employee creation.
 perform 1 from public.organizations where id=org for update;
 for r in select value from jsonb_array_elements(items) loop
 if coalesce(r->>'personnel','') !~ '^[a-zA-Z0-9_-]{1,40}$' or coalesce(r->>'source_id','') !~ '^tinyteam-v13:[a-zA-Z0-9_-]{1,100}$' then raise exception 'Personalnummer/Zeit-ID ungültig';end if;
 if (r->>'minutes') is null or (r->>'minutes') !~ '^[0-9]+$' or (r->>'minutes')::integer>1440 then raise exception 'Minuten ungültig';end if;
 if (r->>'date') is null or (r->>'date') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Datum ungültig';end if;
 if not exists(select 1 from public.cost_centers where id=(r->>'cost_center_id')::uuid and organization_id=org) then raise exception 'Kostenstelle nicht zugänglich';end if;
 select count(*),min(id::text)::uuid into matches,emp from public.employees where organization_id=org and personnel_number=r->>'personnel';
 if matches>1 then raise exception 'Personalnummer mehrfach vorhanden: %',r->>'personnel';end if;
 if matches=0 then insert into public.employees(organization_id,personnel_number,display_name,active) values(org,r->>'personnel',left(r->>'name',150),true) returning id into emp;end if;
 src:=r->>'source_id';
 select * into old from public.time_entries where organization_id=org and source_id=src for update;
 if found then
 if old.employee_id is distinct from emp or old.worked_on is distinct from (r->>'date')::date or old.minutes is distinct from (r->>'minutes')::integer or old.cost_center_id is distinct from (r->>'cost_center_id')::uuid then raise exception 'Geänderte bereits importierte Zeit: %. Bitte separat prüfen.',src;end if;
 skipped:=skipped+1;
 else
 insert into public.time_entries(organization_id,employee_id,cost_center_id,worked_on,minutes,source_id,approval_status) values(org,emp,(r->>'cost_center_id')::uuid,(r->>'date')::date,(r->>'minutes')::integer,src,'pending');added:=added+1;
 end if;
 end loop;
 return jsonb_build_object('imported',added,'skipped',skipped);
end $$;
revoke all on function public.import_tinyteam_times(uuid,jsonb) from public;
grant execute on function public.import_tinyteam_times(uuid,jsonb) to authenticated;
