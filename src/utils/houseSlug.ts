export function houseSlugFromKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function matchesHouseSlug(value: string | null | undefined, slug: string | null | undefined): boolean {
  return houseSlugFromKey(value) === houseSlugFromKey(slug);
}

export function getHousePagePath(asset: {
  house_key?: string | null;
  house?: string | null;
  display_name?: string | null;
}): string {
  return `/house/${houseSlugFromKey(asset.house_key || asset.house || asset.display_name)}`;
}
