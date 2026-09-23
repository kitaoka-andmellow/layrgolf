-- Compact public catalog view used by the Vercel search API.
create or replace view public.course_catalog_public
with (security_invoker = true)
as
select
  gora_course_id,
  pref_code,
  prefecture,
  course_name,
  course_name_abbr,
  course_caption,
  address,
  latitude,
  longitude,
  highway,
  image_url_1,
  weekday_min_price_yen,
  holiday_min_price_yen,
  hole_count,
  par_count,
  course_distance,
  course_type,
  course_vertical_interval,
  evaluation,
  review_count,
  dress_level,
  jacket_required,
  collar_mentioned,
  denim_banned,
  tshirt_banned,
  sandals_banned,
  difficulty_index,
  difficulty_label,
  editorial_nickname,
  editorial_feature_summary,
  dress_code_status,
  gora_reserve_url,
  active
from public.courses
where active = true and detail_ready = true;

grant select on public.course_catalog_public to anon;
