-- =====================================================================
-- Viper OS — Supabase schema
-- Run this ONCE in your project: Supabase Dashboard → SQL Editor → paste → Run.
-- Safe to re-run: everything is idempotent (drops/creates guarded).
-- Model: every table is (id text, data jsonb, updated_at) so the app's rich
-- records (jobs with photos/timeline, estimates with line items, etc.) map 1:1.
-- =====================================================================

-- ---------- 1. TABLES -------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'team','contacts','deals','jobs','estimates','invoices','tasks',
    'conversations','automations','templates','catalog','requests',
    'timesheets','outbox'
  ]
  loop
    execute format('create table if not exists public.%I (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );', t);
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- key/value singletons (settings, counters)
create table if not exists public.meta (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.meta enable row level security;

-- ---------- 2. PROFILES (auth user → role + linked record) -----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','tech','customer')),
  member_id text,     -- team.id  (for techs / owner)
  contact_id text,    -- contacts.id (for customers)
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- helper: role of the current auth user
create or replace function public.current_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "owner reads all profiles" on public.profiles;
create policy "owner reads all profiles" on public.profiles
  for select using (public.current_role() = 'owner');

-- =====================================================================
-- 3. RLS POLICIES
-- ---------------------------------------------------------------------
-- MODE A — DEVELOPMENT (ACTIVE):  any *signed-in* user has full access.
-- Nothing is public: the anon key alone cannot read/write — a real login
-- is required. Perfect while it's just you + staff testing.
--
-- ⚠️  Before you give a REAL CUSTOMER a login, switch to MODE B below so
--     customers can only see their own jobs/invoices. Until then, keep it
--     to yourself and your crew.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'team','contacts','deals','jobs','estimates','invoices','tasks',
    'conversations','automations','templates','catalog','requests',
    'timesheets','outbox','meta'
  ]
  loop
    execute format('drop policy if exists "dev all" on public.%I;', t);
    execute format($p$create policy "dev all" on public.%I
      for all to authenticated using (true) with check (true);$p$, t);
  end loop;
end $$;

-- =====================================================================
-- MODE B — PRODUCTION (role-scoped). Enable when you're ready:
--   1) run the DROP loop to remove the "dev all" policies, then
--   2) uncomment and run the policy block below.
-- =====================================================================
--
-- -- remove dev policies first:
-- do $$ declare t text; begin
--   foreach t in array array['team','contacts','deals','jobs','estimates','invoices','tasks','conversations','automations','templates','catalog','requests','timesheets','outbox','meta']
--   loop execute format('drop policy if exists "dev all" on public.%I;', t); end loop; end $$;
--
-- -- OWNER: full access to everything
-- do $$ declare t text; begin
--   foreach t in array array['team','contacts','deals','jobs','estimates','invoices','tasks','conversations','automations','templates','catalog','requests','timesheets','outbox','meta']
--   loop
--     execute format($p$create policy "owner all" on public.%I for all to authenticated
--       using (public.current_role() = 'owner') with check (public.current_role() = 'owner');$p$, t);
--   end loop; end $$;
--
-- -- TECH: read the config + operational tables; write their own jobs, timesheets, conversations
-- create policy "tech read" on public.jobs for select to authenticated using (public.current_role() = 'tech');
-- create policy "tech write jobs" on public.jobs for update to authenticated
--   using (data->>'assignedTo' = (select member_id from public.profiles where id = auth.uid()));
-- create policy "tech timesheets" on public.timesheets for all to authenticated
--   using (data->>'userId' = (select member_id from public.profiles where id = auth.uid()))
--   with check (data->>'userId' = (select member_id from public.profiles where id = auth.uid()));
-- create policy "tech read contacts" on public.contacts for select to authenticated using (public.current_role() = 'tech');
-- create policy "tech read catalog" on public.catalog for select to authenticated using (public.current_role() = 'tech');
-- create policy "tech read templates" on public.templates for select to authenticated using (public.current_role() = 'tech');
-- create policy "tech conversations" on public.conversations for all to authenticated using (public.current_role() = 'tech') with check (true);
--
-- -- CUSTOMER: only their own linked rows (by contactId)
-- create policy "cust contact" on public.contacts for select to authenticated
--   using (id = (select contact_id from public.profiles where id = auth.uid()));
-- do $$ declare t text; begin
--   foreach t in array array['jobs','estimates','invoices','conversations']
--   loop
--     execute format($p$create policy "cust own" on public.%I for select to authenticated
--       using (data->>'contactId' = (select contact_id from public.profiles where id = auth.uid()));$p$, t);
--     execute format($p$create policy "cust write" on public.%I for update to authenticated
--       using (data->>'contactId' = (select contact_id from public.profiles where id = auth.uid()));$p$, t);
--   end loop; end $$;

-- ---------- 4. REALTIME ----------------------------------------------
-- broadcast row changes so techs' phones and your dashboard stay in sync
do $$
declare t text;
begin
  foreach t in array array[
    'team','contacts','deals','jobs','estimates','invoices','tasks',
    'conversations','automations','templates','catalog','requests',
    'timesheets','outbox','meta'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- 5. STORAGE (progress photos) -----------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects
  for select using (bucket_id = 'job-photos');
drop policy if exists "photos write" on storage.objects;
create policy "photos write" on storage.objects
  for insert to authenticated with check (bucket_id = 'job-photos');
drop policy if exists "photos update" on storage.objects;
create policy "photos update" on storage.objects
  for update to authenticated using (bucket_id = 'job-photos');

-- ---------- 6. REFERENCE-DATA SEED -----------------------------------
-- Config the app needs to run (branded templates, price book, automations,
-- your crew, business settings). Business data (contacts, deals, jobs,
-- estimates, invoices…) starts EMPTY — your clean slate. Re-runnable.
delete from public.templates; delete from public.catalog;
delete from public.automations; delete from public.team;
delete from public.meta;

-- Team (Vipr Electric owners — rename/add crew as needed)
insert into public.team (id, data) values ('u_owner', '{"id":"u_owner","name":"Ben Gloe","role":"Owner / CEO","email":"viprelectric208@gmail.com","phone":"","status":"active","color":"#4f46e5","initials":"BG","hourlyCost":85}'::jsonb);
insert into public.team (id, data) values ('u_cofd', '{"id":"u_cofd","name":"Zach Gardner","role":"Owner / President","email":"viprelectric208@gmail.com","phone":"","status":"active","color":"#0891b2","initials":"ZG","hourlyCost":85}'::jsonb);
insert into public.team (id, data) values ('u_ops', '{"id":"u_ops","name":"Office / Dispatch","role":"Operations","email":"viprelectric208@gmail.com","phone":"","status":"active","color":"#7c3aed","initials":"OD","hourlyCost":45}'::jsonb);

-- Message templates
insert into public.templates (id, data) values ('t_lead', '{"id":"t_lead","name":"New lead welcome","channel":"email","event":"new_lead","enabled":true,"subject":"Thanks for reaching out to {{business_name}}","body":"Hi {{client_name}},\n\nThanks for contacting {{business_name}} — we got your request and someone from our team will reach out within one business day.\n\nIf it''s urgent, call us any time at {{business_phone}}.\n\nTalk soon,\n{{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_est', '{"id":"t_est","name":"Estimate sent","channel":"email","event":"estimate_sent","enabled":true,"subject":"Your estimate {{estimate_number}} from {{business_name}}","body":"Hi {{client_name}},\n\nYour estimate for {{job_title}} is ready — total {{amount}}. You can review and approve it here:\n\n{{link}}\n\nThis quote is good for 30 days. Reply with any questions and we''ll get you on the schedule.\n\nThank you,\n{{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_est_follow', '{"id":"t_est_follow","name":"Estimate follow-up","channel":"email","event":"estimate_followup","enabled":true,"subject":"Following up on estimate {{estimate_number}}","body":"Hi {{client_name}},\n\nJust circling back on the {{amount}} estimate for {{job_title}}. We can still fit you into the schedule — want us to hold a slot?\n\nHappy to walk through anything,\n{{business_name}} · {{business_phone}}"}'::jsonb);
insert into public.templates (id, data) values ('t_booked', '{"id":"t_booked","name":"Appointment confirmation","channel":"sms","event":"job_booked","enabled":true,"subject":"","body":"Hi {{client_name}}, this confirms {{business_name}} is scheduled for {{job_title}} on {{date}} at {{time}}. Your tech will text when on the way. Reply to reschedule."}'::jsonb);
insert into public.templates (id, data) values ('t_omw', '{"id":"t_omw","name":"On my way","channel":"sms","event":"on_my_way","enabled":true,"subject":"","body":"Hi {{client_name}}, {{tech_name}} from {{business_name}} is on the way to {{address}} and should arrive shortly. See you soon!"}'::jsonb);
insert into public.templates (id, data) values ('t_complete', '{"id":"t_complete","name":"Job complete","channel":"email","event":"job_complete","enabled":true,"subject":"Your job is complete — {{business_name}}","body":"Hi {{client_name}},\n\nWe''ve wrapped up {{job_title}}. Thank you for choosing {{business_name}}!\n\nYour invoice will follow shortly. Photos of the finished work are in your client portal.\n\n{{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_inv', '{"id":"t_inv","name":"Invoice sent","channel":"email","event":"invoice_sent","enabled":true,"subject":"Invoice {{invoice_number}} from {{business_name}}","body":"Hi {{client_name}},\n\nYour invoice {{invoice_number}} for {{amount}} is ready. Pay securely online here:\n\n{{link}}\n\nThank you for your business,\n{{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_receipt', '{"id":"t_receipt","name":"Payment receipt","channel":"sms","event":"payment_received","enabled":true,"subject":"","body":"Thanks {{client_name}}! We received your payment of {{amount}}. A receipt is in your portal. We appreciate your business — {{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_won', '{"id":"t_won","name":"Deal won / welcome","channel":"email","event":"deal_won","enabled":true,"subject":"Welcome aboard — {{business_name}}","body":"Hi {{client_name}},\n\nExcited to work with you on {{job_title}}! We''ll be in touch to lock in a date. You now have a client portal where you can track progress and see photos.\n\n{{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_review', '{"id":"t_review","name":"Review request","channel":"sms","event":"review_request","enabled":false,"subject":"","body":"Hi {{client_name}}, it was a pleasure working with you! If you have a minute, a quick review really helps our small business: {{link}}  — {{business_name}}"}'::jsonb);
insert into public.templates (id, data) values ('t_overdue', '{"id":"t_overdue","name":"Overdue reminder","channel":"email","event":"invoice_overdue","enabled":true,"subject":"Friendly reminder: invoice {{invoice_number}} is past due","body":"Hi {{client_name}},\n\nA quick reminder that invoice {{invoice_number}} for {{amount}} is now past due. You can pay securely here:\n\n{{link}}\n\nIf you''ve already sent payment, thank you — please disregard.\n{{business_name}}"}'::jsonb);

-- Price book (Vipr services)
insert into public.catalog (id, data) values ('sv_panel', '{"id":"sv_panel","name":"Panel upgrade / service change","category":"Panels","unit":"each","rate":3200,"cost":1400}'::jsonb);
insert into public.catalog (id, data) values ('sv_ev', '{"id":"sv_ev","name":"EV charger install","category":"EV","unit":"each","rate":1850,"cost":800}'::jsonb);
insert into public.catalog (id, data) values ('sv_newconstruct', '{"id":"sv_newconstruct","name":"New construction — residential","category":"New Construction","unit":"project","rate":8500,"cost":4200}'::jsonb);
insert into public.catalog (id, data) values ('sv_quote', '{"id":"sv_quote","name":"Free quote / estimate","category":"Service","unit":"visit","rate":0,"cost":25}'::jsonb);
insert into public.catalog (id, data) values ('sv_rewire', '{"id":"sv_rewire","name":"Remodel / re-wire / addition","category":"Rewire","unit":"project","rate":3800,"cost":1700}'::jsonb);
insert into public.catalog (id, data) values ('sv_lighting', '{"id":"sv_lighting","name":"Lighting & device upgrade / replacement","category":"Lighting","unit":"each","rate":225,"cost":70}'::jsonb);
insert into public.catalog (id, data) values ('sv_inspect', '{"id":"sv_inspect","name":"Safety inspection","category":"Service","unit":"visit","rate":189,"cost":40}'::jsonb);
insert into public.catalog (id, data) values ('sv_pedestal', '{"id":"sv_pedestal","name":"Pedestal install","category":"Power","unit":"each","rate":950,"cost":380}'::jsonb);
insert into public.catalog (id, data) values ('sv_gen', '{"id":"sv_gen","name":"Generator + transfer switch install","category":"Power","unit":"each","rate":6800,"cost":3400}'::jsonb);
insert into public.catalog (id, data) values ('sv_lightdesign', '{"id":"sv_lightdesign","name":"Lighting design + install","category":"Lighting","unit":"project","rate":2400,"cost":1000}'::jsonb);
insert into public.catalog (id, data) values ('sv_surge', '{"id":"sv_surge","name":"Whole-home surge protection","category":"Panels","unit":"each","rate":595,"cost":190}'::jsonb);
insert into public.catalog (id, data) values ('sv_data', '{"id":"sv_data","name":"Data / communications system","category":"Low Voltage","unit":"project","rate":1400,"cost":520}'::jsonb);
insert into public.catalog (id, data) values ('sv_call', '{"id":"sv_call","name":"Service call / diagnostic","category":"Service","unit":"visit","rate":129,"cost":30}'::jsonb);
insert into public.catalog (id, data) values ('sv_outlet', '{"id":"sv_outlet","name":"Outlet / receptacle install","category":"Devices","unit":"each","rate":185,"cost":45}'::jsonb);

-- Automations
insert into public.automations (id, data) values ('a1', '{"id":"a1","name":"New lead instant reply","trigger":"Contact created with stage = Lead","action":"Send intro email + create \"Call within 24h\" task","enabled":true,"runs":42}'::jsonb);
insert into public.automations (id, data) values ('a2', '{"id":"a2","name":"Estimate follow-up","trigger":"Estimate sent, no reply after 5 days","action":"Send follow-up email + notify owner","enabled":true,"runs":18}'::jsonb);
insert into public.automations (id, data) values ('a3', '{"id":"a3","name":"Job booked confirmation","trigger":"Job scheduled","action":"Text client confirmation + add to calendar","enabled":true,"runs":67}'::jsonb);
insert into public.automations (id, data) values ('a4', '{"id":"a4","name":"On-my-way text","trigger":"Tech marks job In Progress","action":"Text client \"Tech is on the way\"","enabled":true,"runs":51}'::jsonb);
insert into public.automations (id, data) values ('a5', '{"id":"a5","name":"Invoice on completion","trigger":"Job marked Complete","action":"Auto-generate invoice + email pay link","enabled":true,"runs":39}'::jsonb);
insert into public.automations (id, data) values ('a6', '{"id":"a6","name":"Review request","trigger":"Invoice paid","action":"Wait 1 day, then text Google review link","enabled":false,"runs":24}'::jsonb);
insert into public.automations (id, data) values ('a7', '{"id":"a7","name":"Overdue nudge","trigger":"Invoice 3 days overdue","action":"Send firm reminder + notify owner","enabled":true,"runs":11}'::jsonb);

-- Settings + counters
insert into public.meta (key, data) values ('settings', '{"business":{"name":"Vipr Electric","tagline":"Licensed electricians · Kootenai & Bonner County, ID","phone":"","email":"viprelectric208@gmail.com","address":"Kootenai & Bonner County, ID","hours":"Mon–Thurs, 7am–5pm","emergency":"24/7 for customers under warranty","warranty":"1-year warranty","serviceArea":"Kootenai & Bonner County","veteranDiscount":true,"owners":"Ben Gloe (Owner/CEO) · Zach Gardner (Owner/President)"},"branding":{"primary":"#4f46e5","accent":"#06b6d4","logo":null,"favicon":null,"welcome":"Here''s what''s happening at Vipr Electric today.","loginTagline":"Licensed electricians · Kootenai & Bonner County","emailFooter":"Vipr Electric · viprelectric208@gmail.com · Kootenai & Bonner County, ID · Licensed & insured"},"services":[{"id":"svc_host","name":"Website Hosting","category":"Web","price":49,"active":true,"desc":"Fast, secure hosting with SSL and backups."},{"id":"svc_maint","name":"Website Maintenance","category":"Web","price":99,"active":false,"desc":"Updates, edits, and monitoring each month."},{"id":"svc_seo","name":"SEO","category":"Marketing","price":499,"active":false,"desc":"Rank higher and pull in organic leads."},{"id":"svc_lseo","name":"Local SEO","category":"Marketing","price":299,"active":true,"desc":"Own the map pack in your service area."},{"id":"svc_gbp","name":"Google Business Profile","category":"Marketing","price":199,"active":false,"desc":"Managed posts, photos, and Q&A."},{"id":"svc_rep","name":"Reputation Management","category":"Marketing","price":149,"active":false,"desc":"Collect reviews and respond automatically."},{"id":"svc_email","name":"Email Marketing","category":"Marketing","price":199,"active":false,"desc":"Campaigns, sequences, and broadcasts."},{"id":"svc_blog","name":"Blog Writing","category":"Content","price":299,"active":false,"desc":"Fresh SEO articles every month."},{"id":"svc_ai","name":"AI Content","category":"Content","price":99,"active":false,"desc":"On-demand AI copy for any channel."},{"id":"svc_lp","name":"Landing Pages","category":"Web","price":149,"active":false,"desc":"High-converting pages for campaigns."},{"id":"svc_funnel","name":"Funnel Management","category":"Web","price":299,"active":false,"desc":"Built and optimized sales funnels."},{"id":"svc_analytics","name":"Monthly Analytics","category":"Reporting","price":99,"active":true,"desc":"A clear report of what''s working."},{"id":"svc_leads","name":"Lead Generation","category":"Marketing","price":599,"active":false,"desc":"Done-for-you lead campaigns."},{"id":"svc_auto","name":"Automation Services","category":"Ops","price":199,"active":false,"desc":"Custom workflows that save hours."},{"id":"svc_forms","name":"Online Forms","category":"Ops","price":49,"active":false,"desc":"Branded intake and survey forms."},{"id":"svc_booking","name":"Appointment Booking","category":"Ops","price":79,"active":false,"desc":"Online scheduling for your calendar."}],"taxRate":6,"terms":"Net 30","notifRead":false,"dashboard":["kpis","revenue","schedule","pipeline","activity","tasks","leaderboard"],"stageAutomation":{"contacted":{"advanceContact":null,"templateId":null,"task":null,"label":"Logged first contact"},"estimate":{"advanceContact":"prospect","templateId":"t_est","task":"Follow up on estimate in 3 days","label":"Estimate email queued"},"won":{"advanceContact":"customer","templateId":"t_won","task":"Schedule the job","label":"Deal won — client is now a customer"},"lost":{"advanceContact":null,"templateId":null,"task":null,"label":"Marked lost"}}}'::jsonb);
insert into public.meta (key, data) values ('counters', '{"est":1016,"inv":2010,"job":100}'::jsonb);

-- Done. Now create your owner login (see SUPABASE_SETUP.md step 3).
