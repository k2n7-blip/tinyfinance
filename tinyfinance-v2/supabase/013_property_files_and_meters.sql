begin;
create table property_files (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), property_id uuid not null, unit_id uuid,
 title text not null check(length(trim(title)) between 1 and 200), category text not null check(category in ('contract','maintenance','insurance','other')), recorded_on date not null, notes text, document_id uuid, record_version integer not null default 1,
 foreign key(organization_id,property_id) references properties(organization_id,id),
 foreign key(organization_id,property_id,unit_id) references property_units(organization_id,property_id,id),
 foreign key(organization_id,document_id) references documents(organization_id,id)
);
create table property_meters (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), property_id uuid not null, unit_id uuid,
 name text not null check(length(trim(name)) between 1 and 120), serial_number text, medium text not null check(length(trim(medium)) between 1 and 80), measurement_unit text not null check(length(trim(measurement_unit)) between 1 and 20), active boolean not null default true, notes text, record_version integer not null default 1,
 unique(organization_id,id),
 foreign key(organization_id,property_id) references properties(organization_id,id),
 foreign key(organization_id,property_id,unit_id) references property_units(organization_id,property_id,id)
);
create table meter_readings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), meter_id uuid not null,
 read_on date not null, reading numeric(15,3) not null check(reading>=0 and reading<>'NaN'::numeric), notes text, record_version integer not null default 1,
 unique(organization_id,meter_id,read_on), foreign key(organization_id,meter_id) references property_meters(organization_id,id)
);
do $$declare t text;begin
 foreach t in array array['property_files','property_meters','meter_readings'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy private_read on %I for select to authenticated using(can_private(organization_id))',t);
 execute format('create policy private_insert on %I for insert to authenticated with check(can_private(organization_id))',t);
 execute format('create policy private_update on %I for update to authenticated using(can_private(organization_id)) with check(can_private(organization_id))',t);
 execute format('create trigger record_guard before update on %I for each row execute function guard_record()',t);
 execute format('create trigger audit_changes after insert or update on %I for each row execute function append_audit()',t);
 execute format('grant select,insert,update on %I to authenticated',t);
 end loop;
end$$;
create policy house_audit_read on audit_events for select to authenticated using(entity_type in ('property_files','property_meters','meter_readings') and can_private(organization_id));
create function guard_meter_reading() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not can_private(new.organization_id) then raise exception 'Private access denied' using errcode='42501';end if;
 perform 1 from property_meters where id=new.meter_id and organization_id=new.organization_id for update;
 if exists(select 1 from meter_readings where organization_id=new.organization_id and meter_id=new.meter_id and id<>new.id and ((read_on<new.read_on and reading>new.reading) or (read_on>new.read_on and reading<new.reading))) then
 raise exception 'Zählerstände müssen mit dem Ablesedatum ansteigen. Bei Zählerwechsel einen neuen Zähler anlegen.' using errcode='23514';end if;
 return new;
end$$;
create trigger reading_order before insert or update on meter_readings for each row execute function guard_meter_reading();
revoke all on function guard_meter_reading() from public;
create trigger house_file_document_live before insert or update on property_files for each row execute function guard_document_live_link();
create function guard_house_file_document() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.document_id is not null and not document_accessible(new.organization_id,new.document_id) then raise exception 'Document access denied' using errcode='42501';end if;return new;
end$$;
create trigger house_file_document_access before insert or update on property_files for each row execute function guard_house_file_document();
revoke all on function guard_house_file_document() from public;
create function guard_house_file_trash() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.discarded_at is not null and exists(select 1 from property_files where document_id=old.id) then raise exception 'House file document cannot be discarded' using errcode='23503';end if;return new;
end$$;
create trigger house_file_trash before update on documents for each row execute function guard_house_file_trash();
revoke all on function guard_house_file_trash() from public;
commit;
