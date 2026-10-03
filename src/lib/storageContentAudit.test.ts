import {
  AUDIT_TARGETS,
  AuditObservation,
  categoryOf,
  classifyImageUrl,
  extractObservations,
  findMigratedFiles,
  formatBytes,
  renderAuditSummary,
  renderLocalAssetSummary,
  summarizeLocalAssets,
  summarizeObservations,
} from './storageContentAudit';

const REF = 'https://abcdefgh.supabase.co';

describe('classifyImageUrl', () => {
  it('ignores empty and non-string values', () => {
    expect(classifyImageUrl('')).toBeNull();
    expect(classifyImageUrl('   ')).toBeNull();
    expect(classifyImageUrl(null)).toBeNull();
    expect(classifyImageUrl(undefined)).toBeNull();
    expect(classifyImageUrl(42)).toBeNull();
  });

  it('treats root-relative paths as local (Vercel-served)', () => {
    expect(classifyImageUrl('/images/cabinet/amy_1234.webp')).toEqual({
      class: 'local',
      safeUrl: '/images/cabinet/amy_1234.webp',
    });
    expect(classifyImageUrl('/vsa-logo.png')?.class).toBe('local');
  });

  it('does not treat a protocol-relative URL as local', () => {
    expect(classifyImageUrl('//cdn.example.com/a.png')).toMatchObject({ class: 'external', host: 'cdn.example.com' });
  });

  it('recognises public Storage object URLs and extracts the bucket and path', () => {
    expect(classifyImageUrl(`${REF}/storage/v1/object/public/event_images/2024/flyer one.png`)).toMatchObject({
      class: 'supabase-storage',
      bucket: 'event_images',
      objectPath: '2024/flyer%20one.png',
      access: 'public',
      host: 'abcdefgh.supabase.co',
    });
  });

  it('recognises render (transform) URLs as Storage-backed', () => {
    expect(classifyImageUrl(`${REF}/storage/v1/render/image/public/house_images/a.webp?width=400`)).toMatchObject({
      class: 'supabase-storage',
      bucket: 'house_images',
      access: 'render',
      safeUrl: `${REF}/storage/v1/render/image/public/house_images/a.webp`,
    });
  });

  it('strips signed-URL tokens and fragments from the reported URL', () => {
    const out = classifyImageUrl(`${REF}/storage/v1/object/sign/member-photo-requests/pending/a.webp?token=SECRET#x`);
    expect(out).toMatchObject({ class: 'supabase-storage', access: 'sign', bucket: 'member-photo-requests' });
    expect(out?.safeUrl).not.toContain('SECRET');
    expect(out?.safeUrl).not.toContain('?');
  });

  it('classifies a custom domain or local stack as Storage only when told its host', () => {
    const url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/approved/x.webp';
    expect(classifyImageUrl(url)?.class).toBe('external');
    expect(classifyImageUrl(url, { supabaseHost: '127.0.0.1' })).toMatchObject({
      class: 'supabase-storage',
      bucket: 'avatars',
    });
  });

  it('does not call a Supabase host Storage unless the path is a Storage object path', () => {
    expect(classifyImageUrl(`${REF}/functions/v1/thing`)?.class).toBe('external');
    expect(classifyImageUrl('https://evil.example/storage/v1/object/public/event_images/a.png')?.class).toBe('external');
  });

  it('classifies other hosts as external and non-http values as other', () => {
    expect(classifyImageUrl('https://images.example.com/a.png')).toMatchObject({
      class: 'external',
      host: 'images.example.com',
    });
    expect(classifyImageUrl('data:image/png;base64,AAAA')).toEqual({ class: 'other', safeUrl: 'data:…' });
    expect(classifyImageUrl('images/relative.png')?.class).toBe('other');
    expect(classifyImageUrl('not a url')?.class).toBe('other');
  });
});

describe('extractObservations', () => {
  const gallery = AUDIT_TARGETS.filter((t) => t.table === 'gallery_events')[0];

  it('reads scalar and array columns, skipping empties and non-strings', () => {
    const obs = extractObservations(gallery, {
      id: 'g1',
      cover_image_url: `${REF}/storage/v1/object/public/gallery_images/c.jpg`,
      cover_thumbnail_url: '',
      images: ['/images/gallery/1.webp', '  ', null, `${REF}/storage/v1/object/public/gallery_images/2.jpg`],
    });
    expect(obs.map((o) => `${o.column}`)).toEqual(['cover_image_url', 'images[]', 'images[]']);
    expect(obs.every((o) => o.rowId === 'g1' && o.table === 'gallery_events')).toBe(true);
  });

  it('tolerates a null array column', () => {
    expect(extractObservations(gallery, { id: 'g2', images: null })).toEqual([]);
  });
});

describe('summarizeObservations', () => {
  const obs = (table: string, column: string, rowId: string, url: string, context?: unknown): AuditObservation => ({
    table,
    column,
    rowId,
    url,
    ...(context === undefined ? {} : { context }),
  });
  const observations = [
    obs('events', 'image_url', 'e1', '/images/events/a.webp'),
    obs('events', 'image_url', 'e2', `${REF}/storage/v1/object/public/event_images/b.png`, { committed: false }),
    obs('events', 'thumbnail_url', 'e2', `${REF}/storage/v1/object/public/event_images/b_thumb.png`),
    obs('cabinet_members', 'image_url', 'c1', `${REF}/storage/v1/object/public/cabinet_images/c.png`),
    obs('cabinet_members', 'image_url', 'c2', 'https://images.example.com/c.png'),
    obs('site_settings', 'logo_url', 's1', 'data:image/png;base64,AAAA'),
    obs('site_settings', 'logo_url', 's2', '   '),
  ];
  const summary = summarizeObservations(observations);

  it('counts per class and ignores blanks', () => {
    expect(summary.totals).toEqual({ nonEmpty: 6, local: 1, supabaseStorage: 3, external: 1, other: 1 });
  });

  it('gives one sorted row per table.column x class', () => {
    expect(summary.rows.map((r) => `${r.table}.${r.column}:${r.class}:${r.count}`)).toEqual([
      'cabinet_members.image_url:supabase-storage:1',
      'cabinet_members.image_url:external:1',
      'events.image_url:local:1',
      'events.image_url:supabase-storage:1',
      'events.thumbnail_url:supabase-storage:1',
      'site_settings.logo_url:other:1',
    ]);
  });

  it('counts Storage URLs per bucket, largest first', () => {
    expect(summary.buckets).toEqual([
      { bucket: 'event_images', count: 2 },
      { bucket: 'cabinet_images', count: 1 },
    ]);
    expect(summary.externalHosts).toEqual([{ host: 'images.example.com', count: 1 }]);
  });

  it('lists Storage-backed rows with id, column, URL and passes context through', () => {
    expect(summary.storageBacked).toHaveLength(3);
    expect(summary.storageBacked[0]).toMatchObject({
      table: 'cabinet_members',
      column: 'image_url',
      rowId: 'c1',
      bucket: 'cabinet_images',
    });
    const withContext = summary.storageBacked.filter((r) => r.rowId === 'e2' && r.column === 'image_url')[0];
    expect(withContext.context).toEqual({ committed: false });
    expect('context' in summary.storageBacked[0]).toBe(false);
  });

  it('reports zero Storage rows when everything is local', () => {
    const clean = summarizeObservations([obs('events', 'image_url', 'e1', '/images/events/a.webp')]);
    expect(clean.storageBacked).toEqual([]);
    expect(clean.buckets).toEqual([]);
    expect(renderAuditSummary(clean)).toContain('none');
  });

  it('renders a table with every row', () => {
    expect(renderAuditSummary(summary)).toContain('table.column');
    expect(renderAuditSummary(summary)).toContain('events.image_url');
    expect(renderAuditSummary(summary)).toContain('event_images');
  });
});

describe('findMigratedFiles', () => {
  const listing = [
    'amy-nguyen_aaaaaaaa.webp',
    'amy-nguyen_aaaaaaaa_thumb.webp',
    'bob_bbbbbbbb_0123abcd.webp',
    'bob_bbbbbbbb_0123abcd_thumb.webp',
    'bob_bbbbbbbb_notahash1.webp',
  ];

  it('finds the exact migrated name', () => {
    expect(findMigratedFiles(listing, 'amy-nguyen_aaaaaaaa', '')).toEqual({
      expectedName: 'amy-nguyen_aaaaaaaa.webp',
      exists: true,
      hashedVariants: [],
    });
    expect(findMigratedFiles(listing, 'amy-nguyen_aaaaaaaa', '_thumb').exists).toBe(true);
  });

  it('reports a missing file and content-addressed variants separately', () => {
    const result = findMigratedFiles(listing, 'bob_bbbbbbbb', '');
    expect(result.exists).toBe(false);
    expect(result.hashedVariants).toEqual(['bob_bbbbbbbb_0123abcd.webp']);
    expect(findMigratedFiles(listing, 'bob_bbbbbbbb', '_thumb').hashedVariants).toEqual([
      'bob_bbbbbbbb_0123abcd_thumb.webp',
    ]);
  });

  it('treats slug characters literally, not as a pattern', () => {
    expect(findMigratedFiles(['a.b_00000000.webp', 'axb_00000000.webp'], 'a.b', '').hashedVariants).toEqual([
      'a.b_00000000.webp',
    ]);
  });
});

describe('summarizeLocalAssets', () => {
  const files = [
    { path: 'events/a.webp', bytes: 1000 },
    { path: 'events/a_thumb.webp', bytes: 400 },
    { path: 'events/b.webp', bytes: 2000 },
    { path: 'events/b_thumb.webp', bytes: 500 },
    { path: 'events/c.webp', bytes: 300 },
    { path: 'cabinet/p.png', bytes: 5000 },
    { path: 'cabinet/q.webp', bytes: 100 },
    { path: 'vsa-logo.png', bytes: 50 },
  ];
  const summary = summarizeLocalAssets(files, 3);

  it('totals bytes and files', () => {
    expect(summary.totalFiles).toBe(8);
    expect(summary.totalBytes).toBe(9350);
  });

  it('groups by top-level directory, largest first, with a root bucket', () => {
    expect(summary.byCategory).toEqual([
      { category: 'cabinet', files: 2, bytes: 5100 },
      { category: 'events', files: 5, bytes: 4200 },
      { category: '(root)', files: 1, bytes: 50 },
    ]);
    expect(categoryOf('vsa-logo.png')).toBe('(root)');
  });

  it('returns the N largest files', () => {
    expect(summary.largest.map((f) => f.path)).toEqual(['cabinet/p.png', 'events/b.webp', 'events/a.webp']);
  });

  it('measures full vs thumb only for X.webp with an X_thumb.webp sibling', () => {
    expect(summary.thumbnails).toMatchObject({
      pairs: 2,
      fullBytes: 3000,
      thumbBytes: 900,
      savedBytes: 2100,
      fullWithoutThumb: { files: 2, bytes: 400 },
      byCategory: [{ category: 'events', pairs: 2, fullBytes: 3000, thumbBytes: 900 }],
    });
    expect(summary.thumbnails.savedPercent).toBeCloseTo(70, 5);
  });

  it('handles an empty tree', () => {
    const empty = summarizeLocalAssets([]);
    expect(empty.totalBytes).toBe(0);
    expect(empty.thumbnails.savedPercent).toBe(0);
    expect(renderLocalAssetSummary(empty)).toContain('0 files');
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});
