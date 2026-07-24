-- NutriON organized schema (Supabase)
-- intakes:        1 food OR 1 drink = 1 row
-- medical_reports: 1 lab report = 1 row (Blood Sugar + Lipid columns)
-- analyses:       temporary draft before confirm (can ignore in day-to-day editing)

create table if not exists intakes (
  id serial primary key,
  user_id varchar(128) not null default 'default',
  kind varchar(32) not null default 'food',
  name varchar(256) not null default 'Unknown meal',
  serving varchar(128) not null default '1 serving',
  source varchar(64) not null default 'extractor',
  file_path varchar(512) not null default '',
  raw_text text not null default '',
  confidence double precision not null default 0.7,
  confirmed boolean not null default false,
  analysis_id varchar(64) not null default '',
  is_estimated boolean not null default false,
  input_type varchar(32) not null default 'food',
  calories double precision not null default 0,
  protein_g double precision not null default 0,
  carbs_g double precision not null default 0,
  fat_g double precision not null default 0,
  fiber_g double precision not null default 0,
  sugar_g double precision not null default 0,
  sodium_mg double precision not null default 0,
  extras_json text not null default '{}',
  logged_at timestamptz not null default now()
);

create index if not exists ix_intakes_user_id on intakes (user_id);
create index if not exists ix_intakes_kind on intakes (kind);
create index if not exists ix_intakes_logged_at on intakes (logged_at);

create table if not exists analyses (
  id varchar(64) primary key,
  user_id varchar(128) not null default 'default',
  kind varchar(32) not null,
  status varchar(32) not null default 'pending',
  file_path varchar(512) not null default '',
  result_json text not null default '{}',
  raw_text text not null default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz null
);

create table if not exists medical_reports (
  id serial primary key,
  user_id varchar(128) not null default 'default',
  analysis_id varchar(64) not null default '',
  test_date date null,
  file_path varchar(512) not null default '',
  confidence double precision not null default 0.5,
  confirmed boolean not null default true,
  notes text not null default '',
  -- Blood Sugar
  hba1c double precision null,
  hba1c_status varchar(32) null,
  fasting_glucose double precision null,
  fasting_glucose_status varchar(32) null,
  -- Lipid Profile
  total_cholesterol double precision null,
  total_cholesterol_status varchar(32) null,
  ldl double precision null,
  ldl_status varchar(32) null,
  hdl double precision null,
  hdl_status varchar(32) null,
  triglycerides double precision null,
  triglycerides_status varchar(32) null,
  created_at timestamptz not null default now()
);

create index if not exists ix_medical_reports_user_id on medical_reports (user_id);
create index if not exists ix_medical_reports_created_at on medical_reports (created_at);

-- Easy-to-browse views in Table Editor
create or replace view food_entries as
select
  id,
  user_id,
  name,
  serving,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  sugar_g,
  sodium_mg,
  confirmed,
  source,
  logged_at
from intakes
where kind = 'food'
order by logged_at desc;

create or replace view drink_entries as
select
  id,
  user_id,
  name,
  serving,
  calories,
  carbs_g,
  sugar_g,
  sodium_mg,
  confirmed,
  source,
  logged_at
from intakes
where kind = 'drink'
order by logged_at desc;

-- Optional: drop legacy per-metric table after migration
-- drop table if exists medical_metrics;
