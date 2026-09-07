-- Lumiere Patient Feedback System — run once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tables

create table if not exists branches (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name_en    text not null,
  name_ar    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qr_locations (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references branches(id) on delete cascade,
  code       text not null,
  label_en   text not null,
  label_ar   text not null,
  created_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table if not exists cases (
  id              uuid primary key default gen_random_uuid(),
  ref             text unique not null,
  branch_id       uuid not null references branches(id),
  qr_location_id  uuid references qr_locations(id),
  category        text not null,
  description     text,
  voice_url       text,
  patient_name    text not null,
  mobile          text not null,
  preferred_lang  text not null default 'en',
  contact_method  text not null default 'call',
  preferred_time  text not null default 'morning',
  priority        text not null default 'normal',
  status          text not null default 'assigned',
  assigned_to     text,
  sla_due_at      timestamptz not null,
  resolution_note text,
  closure_reason  text,
  refund_amount   numeric(10,2),
  refund_status   text,
  satisfaction    int,
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references cases(id) on delete cascade,
  type       text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

create index if not exists cases_branch_idx     on cases (branch_id);
create index if not exists cases_status_idx     on cases (status);
create index if not exists cases_category_idx   on cases (category);
create index if not exists cases_priority_idx   on cases (priority);
create index if not exists cases_created_idx    on cases (created_at desc);
create index if not exists cases_ref_idx        on cases (ref);
create index if not exists case_events_case_idx on case_events (case_id, created_at);
create index if not exists qr_locations_branch_idx on qr_locations (branch_id);

-- Reference sequence: LSC-{BRANCH}-{YYMM}-{0001}. A row per branch+month, bumped
-- atomically so two simultaneous submissions can never take the same number.
create table if not exists case_counters (
  branch_code text not null,
  period      text not null,
  seq         int  not null default 0,
  primary key (branch_code, period)
);

create or replace function next_case_ref(p_branch_code text, p_period text)
returns text
language plpgsql
as $$
declare v_seq int;
begin
  insert into case_counters (branch_code, period, seq)
  values (p_branch_code, p_period, 1)
  on conflict (branch_code, period)
    do update set seq = case_counters.seq + 1
  returning seq into v_seq;

  return 'LSC-' || p_branch_code || '-' || p_period || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Mutable app settings, currently just the admin password hash. No row means
-- ADMIN_PASS from the environment still applies — deleting the row is the way
-- back in if the stored password is ever lost.
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- row level security
-- Every read and write goes through the Next.js server with the service-role
-- key, which bypasses RLS. RLS stays ON with no policies so the anon key —
-- the only key that ever reaches a browser — can read and write nothing.

alter table branches     enable row level security;
alter table qr_locations enable row level security;
alter table cases        enable row level security;
alter table case_events  enable row level security;
alter table case_counters enable row level security;
alter table app_settings  enable row level security;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do update set public = true;

-- Public read of voice notes (the admin's inline <audio> player fetches them
-- directly); uploads only ever happen server-side with the service-role key.
drop policy if exists "voice notes are publicly readable" on storage.objects;
create policy "voice notes are publicly readable"
  on storage.objects for select
  using (bucket_id = 'voice-notes');

-- ---------------------------------------------------------------- seed data

-- The ten patient-facing branches: six in Abu Dhabi, three in Al Ain, one in
-- Dubai. Names match the facility list used by the HR and finance systems.
insert into branches (code, name_en, name_ar) values
  ('BR01', 'Main Branch',   'الفرع الرئيسي'),
  ('BR02', 'Galleria',      'الغاليريا'),
  ('BR03', 'Yas Mall',      'ياس مول'),
  ('BR04', 'Bawabat',       'بوابة الشرق'),
  ('BR05', 'Deerfields',    'ديرفيلدز'),
  ('BR06', 'Delma',         'دلما'),
  ('BR07', 'Al Ain Ladies', 'سيدات العين'),
  ('BR08', 'Bawadi',        'البوادي'),
  ('BR09', 'Makani',        'مكاني'),
  ('BR10', 'Dubai',         'دبي')
on conflict (code) do nothing;

insert into qr_locations (branch_id, code, label_en, label_ar)
select b.id, l.code, l.label_en, l.label_ar
from branches b
cross join (values
  ('REC', 'Reception',      'الاستقبال'),
  ('TR1', 'Treatment Room', 'غرفة العلاج'),
  ('WA1', 'Waiting Area',   'منطقة الانتظار')
) as l(code, label_en, label_ar)
on conflict (branch_id, code) do nothing;
