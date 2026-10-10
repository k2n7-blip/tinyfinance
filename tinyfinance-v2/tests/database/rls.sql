grant all on all tables in schema public,storage to authenticated;
grant usage on all sequences in schema public to authenticated;
create function public.assert_true(condition boolean,message text) returns void language plpgsql as $$begin if condition is distinct from true then raise exception 'FAILED: %',message;end if;raise notice 'PASS: %',message;end$$;
create function public.expect_error(command text,expected_state text,message text) returns void language plpgsql as $$
declare caught boolean:=false;begin
 begin execute command;exception when others then
 if sqlstate<>expected_state then raise exception 'FAILED: %, expected %, got % (%)',message,expected_state,sqlstate,sqlerrm;end if;caught:=true;
 end;
 if not caught then raise exception 'FAILED: % did not fail',message;end if;raise notice 'PASS: %',message;
end$$;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444'),('55555555-5555-4555-8555-555555555555');
insert into organizations(id,name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test A'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test B');
insert into memberships values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner',false,false),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','bookkeeper',false,false),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','advisor_read',false,false),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','viewer',false,false),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','55555555-5555-4555-8555-555555555555','owner',false,false);
insert into finance_settings(organization_id,fiscal_year_start,advisor_number,client_number) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-01-01','12345','1'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-01-01','12345','2');
insert into cost_centers(id,organization_id,code,name,active) values
('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','100','Test house',true),
('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','200','Other house',true);
insert into tax_subjects(id,organization_id,name,subject_type) values('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Private test','private');
insert into employees(organization_id,name,personnel_number,external_team_id,hourly_cost) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test employee','1','team-1',20);
insert into documents(id,organization_id,original_filename,storage_path,sha256,mime_type) values
('30000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test.pdf','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test.pdf',repeat('a',64),'application/pdf'),
('30000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other.pdf','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/other.pdf',repeat('b',64),'application/pdf');
insert into documents(id,organization_id,original_filename,storage_path,sha256,mime_type,tax_subject_id) values
('30000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','private.pdf','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/private.pdf',repeat('c',64),'application/pdf','20000000-0000-4000-8000-000000000001');
update documents set vendor='Test vendor',invoice_number='RE-2026-1',invoice_date='2026-10-01',service_date='2026-10-01',net_amount=100,vat_amount=19,gross_amount=119,review_status='reviewed';
insert into chart_accounts(id,organization_id,account_number,description,approved_by_advisor,kind) values
('40000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','4900','Expense',true,'expense'),
('40000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1200','Bank',true,'bank');
insert into bank_accounts(id,organization_id,name,account_type) values
('50000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Business bank','business'),
('50000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Private bank','private'),
('50000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Second business bank','business');
insert into bank_transactions(id,organization_id,bank_account_id,booked_on,amount,source_reference) values
('60000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','2026-10-02',-119,'bank-1'),
('60000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000002','2026-10-02',-119,'private-bank-1'),
('60000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','2026-10-02',-50,'transfer-out'),
('60000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000003','2026-10-02',50,'transfer-in'),
('60000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','2026-10-02',90,'payout');
insert into platform_settlements(id,organization_id,platform,reference,period_start,period_end,gross_amount,commission,refunds,payout,cost_center_id) values
('70000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Holidu','payout-1','2026-10-01','2026-10-02',100,10,0,90,'10000000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values('documents','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test.pdf'),('documents','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/other.pdf'),('documents','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/private.pdf');
set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal1"}';
select assert_true((select count(*) from documents)=0,'Owner without MFA cannot read financial documents');
select assert_true((select count(*) from memberships)=1,'MFA setup can read own membership');
select expect_error($q$select create_organization('Blocked')$q$,'42501','Owner AAL1 cannot create organization');
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111"}';
select expect_error($q$select create_organization('Blocked')$q$,'42501','Missing AAL claim cannot bypass MFA');
set request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","aal":"aal1"}';
select assert_true((select count(*) from documents)=1,'Viewer sees only own business documents');
select expect_error($q$insert into cost_centers(organization_id,code,name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','999','Forbidden')$q$,'42501','Viewer cannot write');
select assert_true((select count(*) from employees)=0,'Viewer cannot read personnel');
select assert_true((select count(*) from tax_subjects)=0,'Viewer cannot read private tax subjects');
set request.jwt.claims='{"sub":"33333333-3333-4333-8333-333333333333","aal":"aal1"}';
select assert_true((select count(*) from employees)=0,'Advisor cannot read personnel');
select assert_true((select count(*) from documents)=1,'Advisor cannot read private documents');
select assert_true((select count(*) from storage.objects)=1,'Advisor Storage access follows document classification');
select assert_true((select count(*) from bank_accounts)=2,'Advisor cannot read private bank account');
select assert_true((select count(*) from bank_transactions)=4,'Advisor cannot read private bank transactions');
select expect_error($q$insert into audit_events(organization_id,entity_type,entity_id,action) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','forged','30000000-0000-4000-8000-000000000001','FORGED')$q$,'42501','Audit events cannot be forged');
set request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","aal":"aal1"}';
select expect_error($q$update documents set cost_center_id='10000000-0000-4000-8000-000000000002' where id='30000000-0000-4000-8000-000000000001'$q$,'23503','Cross-tenant FK rejected');
select expect_error($q$update documents set sha256=repeat('d',64) where id='30000000-0000-4000-8000-000000000001'$q$,'P0001','Original hash is immutable');
select expect_error($q$select confirm_bank_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',119)$q$,'P0001','Bookkeeper cannot match private bank');
select expect_error($q$select confirm_bank_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',119)$q$,'P0001','Bookkeeper cannot match private document');
select expect_error($q$select confirm_bank_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','NaN')$q$,'P0001','NaN matching rejected at DB boundary');
select confirm_bank_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',119);
select expect_error($q$select confirm_bank_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1)$q$,'P0001','Matching cannot exceed transaction or document amount');
select confirm_bank_transfer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004');
select expect_error($q$select confirm_bank_transfer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004')$q$,'P0001','Already matched transfer cannot duplicate');
select confirm_settlement_match('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000001',90);
select assert_true((select status from platform_settlements where id='70000000-0000-4000-8000-000000000001')='reconciled','Platform payout is reconciled only after matching');
select expect_error($q$update platform_settlements set gross_amount=200,payout=190 where id='70000000-0000-4000-8000-000000000001'$q$,'P0001','Matched platform amounts are locked');
select assert_true((dashboard_totals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'unmatched')::integer=0,'Dashboard includes document, platform and transfer matches');
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}';
select assert_true((select count(*) from documents)=2,'AAL2 owner sees business and private documents in own tenant');
select assert_true((select count(*) from documents where organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')=0,'Owner cannot see another tenant');
select expect_error($q$select set_membership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','viewer',false,false)$q$,'P0001','Last administrator cannot be demoted');
select expect_error($q$select revoke_membership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')$q$,'P0001','Last administrator cannot be removed');
select save_posting('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"document_id":"30000000-0000-4000-8000-000000000001","posting_date":"2026-10-01","amount":"119.00","debit_account_id":"40000000-0000-4000-8000-000000000001","credit_account_id":"40000000-0000-4000-8000-000000000002","description":"Test expense","vat_code":"","allocations":[{"cost_center_id":"10000000-0000-4000-8000-000000000001","amount":"119.00"}]}') as posting_id \gset
select assert_true((select sum(amount) from posting_allocations where posting_id=:'posting_id')=119,'Posting allocation persisted');
select expect_error(format('select approve_posting(%L,%L,NULL)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'posting_id'),'40001','Approval requires expected version');
select approve_posting('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'posting_id',1);
select assert_true((select status from postings where id=:'posting_id')='approved','Reviewed posting can be explicitly approved');
select expect_error($q$update documents set vendor='Changed' where id='30000000-0000-4000-8000-000000000001'$q$,'P0001','Approved document cannot be edited');
select expect_error($q$update chart_accounts set account_number='4901' where id='40000000-0000-4000-8000-000000000001'$q$,'P0001','Approved account number cannot change');
select expect_error($q$update cost_centers set code='101' where id='10000000-0000-4000-8000-000000000001'$q$,'P0001','Historical cost center code is locked');
select reverse_posting('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'posting_id','2026-10-03','Correction') as reversed_id \gset
select assert_true((select reversal_of from postings where id=:'reversed_id')=:'posting_id'::uuid,'Storno creates linked immutable counterposting');
select expect_error(format('select reverse_posting(%L,%L,%L,%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'posting_id','2026-10-03','Again'),'23505','Duplicate reversal rejected');
select expect_error($q$select import_bank('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','test.csv','hash','[{"booked_on":"2026-10-01","amount":"5.00","currency":"EUR","source_reference":"atomic-first"},{"booked_on":"2026-10-01","amount":"0.00","currency":"EUR","source_reference":"atomic-second"}]')$q$,'P0001','Invalid bank file is atomic');
select assert_true((select count(*) from bank_transactions where source_reference='atomic-first')=0,'Failed import did not retain earlier rows');
select import_bank('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','test.csv','hash','[{"booked_on":"2026-10-01","amount":"5.00","currency":"EUR","source_reference":"repeatable"}]');
select assert_true((import_bank('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','test.csv','hash','[{"booked_on":"2026-10-01","amount":"5.00","currency":"EUR","source_reference":"repeatable"}]')->>'duplicates')::integer=1,'Repeated import is idempotent');
select expect_error($q$select import_bank('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','50000000-0000-4000-8000-000000000001','test.csv','hash','[{"booked_on":"2026-10-01","amount":"6.00","currency":"EUR","source_reference":"repeatable"}]')$q$,'23505','Conflicting bank reference is rejected');
reset role;
select expect_error($q$update audit_events set action='FORGED' where id=(select min(id) from audit_events)$q$,'42501','Audit immutability also enforced by trigger');
select assert_true((select count(*) from audit_events where entity_type='postings')>=3,'Posting, approval and reversal are audited');
select 'All database assertions passed' as result;
