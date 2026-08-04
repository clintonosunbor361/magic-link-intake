begin;

select plan(7);

insert into public.organizations (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Kuartz One', 'kuartz-one'),
  ('20000000-0000-0000-0000-000000000002', 'Kuartz Two', 'kuartz-two');

insert into public.staff_profiles (id, full_name, email) values
  ('11000000-0000-0000-0000-000000000001', 'Roti Akinola', 'roti@example.test'),
  ('12000000-0000-0000-0000-000000000001', 'Teni Adesina', 'teni@example.test'),
  ('21000000-0000-0000-0000-000000000002', 'Moyo Balogun', 'moyo@example.test'),
  ('13000000-0000-0000-0000-000000000001', 'Archived Admin', 'archived@example.test');

insert into public.organization_memberships (organization_id, user_id, role, archived_at) values
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'super_admin', null),
  ('10000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'admin_assistant', null),
  ('20000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'super_admin', null),
  ('10000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'super_admin', now());

insert into public.audit_entries (id, organization_id, actor_id, action, entity_type, entity_id, summary) values
  ('a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'staff.invited', 'staff_membership', '12000000-0000-0000-0000-000000000001', 'Invited Teni Adesina.'),
  ('a2000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'staff.invited', 'staff_membership', '21000000-0000-0000-0000-000000000002', 'Created Moyo Balogun.');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select slug from public.organizations order by slug $$,
  array['kuartz-one'],
  'a Staff Member sees only their organization'
);

select results_eq(
  $$ select user_id::text from public.organization_memberships order by user_id $$,
  array['11000000-0000-0000-0000-000000000001'],
  'membership RLS exposes only the current Staff Member'
);

select results_eq(
  $$ select id::text from public.audit_entries order by id $$,
  array['a1000000-0000-0000-0000-000000000001'],
  'an active Super Admin sees audit entries in their organization'
);

select throws_ok(
  $$ update public.organization_memberships set role = 'super_admin' where user_id = '12000000-0000-0000-0000-000000000001' $$,
  '42501',
  'permission denied for table organization_memberships',
  'authenticated users cannot mutate memberships directly'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select is_empty(
  $$ select id from public.audit_entries $$,
  'an Admin Assistant cannot read organization audit entries'
);

select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select slug from public.organizations $$,
  array['kuartz-two'],
  'a Super Admin cannot read another organization'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
select is_empty(
  $$ select id from public.audit_entries $$,
  'an archived Super Admin has no audit access'
);

select * from finish();
rollback;
