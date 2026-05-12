-- Normalize historical Executive Board display order.
-- This updates order only; member data, categories, and cabinet years are unchanged.

with ranked_executive_members as (
  select
    cabinet_members.id,
    case
      when lower(cabinet_members.role) like '%president%'
        and lower(cabinet_members.role) not like '%vice president%' then 10
      when lower(trim(cabinet_members.role)) = 'vice president'
        or lower(cabinet_members.role) like '%internal vice president%' then 20
      when lower(cabinet_members.role) like '%external vice president%' then 30
      when lower(cabinet_members.role) like '%intercollegiate council%'
        or cabinet_members.role ~* '(^|[^[:alpha:]])ICC([^[:alpha:]]|$)' then 40
      when lower(trim(cabinet_members.role)) = 'secretary' then 50
      when lower(trim(cabinet_members.role)) = 'treasurer' then 60
      else 90
    end as order_bucket,
    row_number() over (
      partition by
        cabinet_members.cabinet_year_id,
        case
          when lower(cabinet_members.role) like '%president%'
            and lower(cabinet_members.role) not like '%vice president%' then 10
          when lower(trim(cabinet_members.role)) = 'vice president'
            or lower(cabinet_members.role) like '%internal vice president%' then 20
          when lower(cabinet_members.role) like '%external vice president%' then 30
          when lower(cabinet_members.role) like '%intercollegiate council%'
            or cabinet_members.role ~* '(^|[^[:alpha:]])ICC([^[:alpha:]]|$)' then 40
          when lower(trim(cabinet_members.role)) = 'secretary' then 50
          when lower(trim(cabinet_members.role)) = 'treasurer' then 60
          else 90
        end
      order by cabinet_members.display_order, cabinet_members.created_at, cabinet_members.id
    ) - 1 as bucket_offset
  from public.cabinet_members
  join public.cabinet_years
    on cabinet_years.id = cabinet_members.cabinet_year_id
  where cabinet_years.slug between '2003-2004' and '2024-2025'
    and cabinet_members.category = 'Executive Board'
)
update public.cabinet_members
set display_order = ranked_executive_members.order_bucket + ranked_executive_members.bucket_offset
from ranked_executive_members
where cabinet_members.id = ranked_executive_members.id
  and cabinet_members.display_order is distinct from ranked_executive_members.order_bucket + ranked_executive_members.bucket_offset;
