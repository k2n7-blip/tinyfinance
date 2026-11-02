-- Run after rls.sql; all test writes are rolled back.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}';
insert into house_costs(id,organization_id,cost_center_id,name,kind,amount,starts_month,recurrence,basis)
select '93000000-0000-4000-8000-000000000001',organization_id,id,'Monthly fixture','fixed',100,'2026-11','monthly','planned'
from cost_centers where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by id limit 1;
select assert_true((select count(*) from house_costs where id='93000000-0000-4000-8000-000000000001')=1,'Owner can insert a house cost');
update house_costs set amount=200 where id='93000000-0000-4000-8000-000000000001';
select assert_true((select record_version from house_costs where id='93000000-0000-4000-8000-000000000001')=2,'Cost edits increment version');
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","aal":"aal1"}';
select assert_true((select count(*) from house_costs where id='93000000-0000-4000-8000-000000000001')=1,'Viewer can read business house cost');
update house_costs set amount=999 where id='93000000-0000-4000-8000-000000000001';
select assert_true((select amount from house_costs where id='93000000-0000-4000-8000-000000000001')=200,'Viewer cannot edit house cost');
select expect_error($q$insert into house_costs(organization_id,cost_center_id,name,kind,amount,starts_month,recurrence,basis) select organization_id,cost_center_id,'Forbidden','fixed',1,'2026-11','monthly','planned' from house_costs limit 1$q$,'42501','Viewer cannot insert cost');
set local request.jwt.claims='{"sub":"55555555-5555-4555-8555-555555555555","aal":"aal2"}';
select assert_true((select count(*) from house_costs where id='93000000-0000-4000-8000-000000000001')=0,'Other organization cannot read cost');
reset role;
select assert_true(not has_table_privilege('anon','house_costs','SELECT'),'Anon has no cost read grant');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}';
delete from house_costs where id='93000000-0000-4000-8000-000000000001';
select assert_true((select count(*) from house_costs where id='93000000-0000-4000-8000-000000000001')=1,'Costs are deactivated, not deleted');
reset role;
rollback;
