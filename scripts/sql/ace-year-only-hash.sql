-- #675: owner-only, READ-ONLY shape-preservation fingerprint.
-- Run in the approved SQL editor BEFORE and AFTER each #670 year-only backfill.
-- Compare fam/node counts and shape_hash. A mismatch is a STOP / review;
-- never paste source records, PII, full table exports or hashed raw rows in PRs.
begin transaction read only;
select
  f.slug as published_fam_slug,
  count(m.id)::integer as stored_nodes,
  md5(coalesce(string_agg(
    jsonb_build_array(
      m.id, m.name, m.family_id, m.parent_member_id, m.member_id,
      m.photo_url, m.role_label, m.display_order, m.is_published
    )::text, E'\x1f' order by m.id
  ), '')) as shape_hash
from public.ace_families f
left join public.ace_family_members m on m.family_id = f.id
where f.is_published = true
group by f.id, f.slug
order by f.slug;
commit;
