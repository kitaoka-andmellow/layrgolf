-- COURSE CODE production schema
-- Run in Supabase SQL editor once before the first sync.

create extension if not exists pg_trgm;

create table if not exists public.courses (
  gora_course_id bigint primary key,
  pref_code smallint not null,
  prefecture text not null,
  course_name text not null,
  course_name_abbr text,
  course_name_kana text,
  course_caption text,
  information text,
  highway text,
  ic text,
  ic_distance text,
  latitude double precision,
  longitude double precision,
  postal_code text,
  address text,
  telephone_no text,
  fax_no text,
  open_day text,
  close_day text,
  credit_card text,
  shoes_raw text,
  dress_code_raw text,
  practice_facility text,
  lodging_facility text,
  other_facility text,
  image_url_1 text,
  image_url_2 text,
  image_url_3 text,
  image_url_4 text,
  image_url_5 text,
  weekday_min_price_yen integer,
  base_weekday_min_price_yen integer,
  holiday_min_price_yen integer,
  base_holiday_min_price_yen integer,
  designer text,
  course_type text,
  course_vertical_interval text,
  dimension text,
  green text,
  green_count text,
  hole_count integer,
  par_count integer,
  course_names text,
  course_distance text,
  long_driving_contest text,
  near_pin text,
  review_count integer,
  evaluation double precision,
  rating_staff double precision,
  rating_facility double precision,
  rating_meal double precision,
  rating_course double precision,
  rating_costperformance double precision,
  rating_distance double precision,
  rating_fairway double precision,
  gora_detail_url text,
  gora_reserve_url text,
  gora_rating_url text,
  gora_voice_url text,
  gora_layout_url text,
  gora_route_map_url text,
  dress_level text check (dress_level is null or dress_level in ('FORMAL','SMART','RELAXED')),
  jacket_mentioned boolean,
  jacket_required boolean,
  collar_mentioned boolean,
  denim_banned boolean,
  tshirt_banned boolean,
  sandals_banned boolean,
  tuck_in_mentioned boolean,
  shorts_mentioned boolean,
  socks_mentioned boolean,
  golf_shoes_mentioned boolean,
  dress_code_status text,
  difficulty_index integer,
  difficulty_label text,
  editorial_nickname text,
  editorial_feature_summary text,
  editorial_disclosure text,
  source_stage text,
  api_source_url text,
  fetched_at timestamptz,
  record_updated_at timestamptz,
  active boolean not null default true,
  detail_ready boolean not null default false,
  last_seen_sync_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasonal_guides (
  gora_course_id bigint not null references public.courses(gora_course_id) on delete cascade,
  season text not null check (season in ('spring','summer','autumn','winter')),
  climate_zone text not null,
  regional_condition text,
  wear_recommendation text,
  etiquette_note text,
  data_type text not null default 'editorial_guidance',
  rule_version text,
  updated_at timestamptz not null default now(),
  primary key (gora_course_id, season)
);

create table if not exists public.affiliate_slots (
  gora_course_id bigint not null references public.courses(gora_course_id) on delete cascade,
  slot text not null,
  season text not null default 'all',
  category text,
  rakuten_search_keyword text,
  source_type text not null default 'rakuten_ichiba',
  item_name text,
  item_price_yen integer,
  item_image_url text,
  target_url text,
  affiliate_rate double precision,
  item_code text,
  fetched_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (gora_course_id, slot, season)
);

create table if not exists public.sync_runs (
  sync_id uuid primary key,
  sync_mode text not null check (sync_mode in ('search','full','ads')),
  status text not null check (status in ('running','success','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  course_count integer,
  detail_count integer,
  dress_code_count integer,
  message text
);

create index if not exists idx_courses_active_pref on public.courses(active, pref_code);
create index if not exists idx_courses_price_weekday on public.courses(weekday_min_price_yen) where active;
create index if not exists idx_courses_price_holiday on public.courses(holiday_min_price_yen) where active;
create index if not exists idx_courses_dress on public.courses(dress_level) where active;
create index if not exists idx_courses_difficulty on public.courses(difficulty_index) where active;
create index if not exists idx_courses_lat_lon on public.courses(latitude, longitude) where active;
create index if not exists idx_courses_name_trgm on public.courses using gin (course_name gin_trgm_ops);
create index if not exists idx_courses_address_trgm on public.courses using gin (address gin_trgm_ops);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at before update on public.courses
for each row execute function public.touch_updated_at();

drop trigger if exists trg_seasons_updated_at on public.seasonal_guides;
create trigger trg_seasons_updated_at before update on public.seasonal_guides
for each row execute function public.touch_updated_at();

drop trigger if exists trg_affiliate_updated_at on public.affiliate_slots;
create trigger trg_affiliate_updated_at before update on public.affiliate_slots
for each row execute function public.touch_updated_at();

-- Called only after a complete nationwide search has succeeded.
create or replace function public.course_code_finalize_sync(p_sync_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.courses
     set active = (last_seen_sync_id = p_sync_id),
         updated_at = now()
   where active is distinct from (last_seen_sync_id = p_sync_id);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.course_code_finalize_sync(uuid) from public, anon, authenticated;
grant execute on function public.course_code_finalize_sync(uuid) to service_role;

alter table public.courses enable row level security;
alter table public.seasonal_guides enable row level security;
alter table public.affiliate_slots enable row level security;
alter table public.sync_runs enable row level security;

-- SQL privileges and RLS are both required.
grant select on public.courses, public.seasonal_guides, public.affiliate_slots to anon;
grant all on public.courses, public.seasonal_guides, public.affiliate_slots, public.sync_runs to service_role;

-- The browser never writes. Public reads are limited to active catalog records.
drop policy if exists "anon_read_active_courses" on public.courses;
create policy "anon_read_active_courses"
on public.courses for select to anon
using (active = true and detail_ready = true);

drop policy if exists "anon_read_active_seasons" on public.seasonal_guides;
create policy "anon_read_active_seasons"
on public.seasonal_guides for select to anon
using (exists (
  select 1 from public.courses c
  where c.gora_course_id = seasonal_guides.gora_course_id and c.active = true and c.detail_ready = true
));

drop policy if exists "anon_read_active_affiliate" on public.affiliate_slots;
create policy "anon_read_active_affiliate"
on public.affiliate_slots for select to anon
using (exists (
  select 1 from public.courses c
  where c.gora_course_id = affiliate_slots.gora_course_id and c.active = true and c.detail_ready = true
));

-- sync_runs intentionally has no anon/authenticated policy.
