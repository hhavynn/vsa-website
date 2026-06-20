import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { useCabinetYears } from '../hooks/useCabinetYears';
import { useCabinetMemberYearIds, useCabinetMembers, type CabinetMemberRaw } from '../hooks/useCabinet';
import { formatCabinetYearRange, getCurrentCabinetYear } from '../lib/cabinetYears';
import { CabinetYear } from '../types';
import { getSupabaseImageUrl } from '../lib/supabaseImages';
import { motion } from 'framer-motion';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { CabinetRoleExplorer } from '../components/features/cabinet/CabinetRoleExplorer';

type CabinetMember = CabinetMemberRaw;

const publicUrl = process.env.PUBLIC_URL || '';
const cabinetImage = (fileName: string) => `${publicUrl}/images/cabinet/${fileName}`;

function resolveImageUrl(image?: string | null) {
  if (!image) return null;
  return image.startsWith('http') || image.startsWith('data:') || image.startsWith('/') ? image : cabinetImage(image);
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function groupByRole(members: CabinetMember[]) {
  const groups = new Map<string, CabinetMember[]>();
  members.forEach((member) => {
    const current = groups.get(member.role) ?? [];
    current.push(member);
    groups.set(member.role, current);
  });
  return Array.from(groups.entries());
}

function formatMeta(member: CabinetMember) {
  return [member.year, member.college, member.major].filter(Boolean).slice(0, 3).join(' / ');
}

function getCabinetPhotoUrl(member: CabinetMember) {
  return member.thumbnail_url || member.image_url;
}

function normalizeCabinetYearQuery(value: string | null | undefined) {
  if (!value) return '';
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
  const range = normalized.match(/\b(\d{4})\s*-\s*(\d{4})\b/);
  if (range) return `${range[1]}-${range[2]}`;
  return normalized.replace(/\s*cabinet\s*/g, '').trim();
}

function cabinetYearQueryValue(year: CabinetYear) {
  const slug = normalizeCabinetYearQuery(year.slug);
  if (slug) return slug;
  return `${year.start_year}-${year.end_year}`;
}

function cabinetYearMatchesQuery(year: CabinetYear, query: string) {
  const normalizedQuery = normalizeCabinetYearQuery(query);
  if (!normalizedQuery) return false;
  return [
    cabinetYearQueryValue(year),
    year.slug,
    year.label,
    `${year.start_year}-${year.end_year}`,
  ].some((value) => normalizeCabinetYearQuery(value) === normalizedQuery);
}

function rolePriority(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes('president') && !normalized.includes('vice president')) return 0;
  if (normalized.includes('internal vice president') || normalized.trim() === 'vice president') return 1;
  if (normalized.includes('external vice president')) return 2;
  if (normalized.includes('intercollegiate council') || /\bicc\b/.test(normalized)) return 3;
  if (normalized.includes('secretary')) return 4;
  if (normalized.includes('treasurer')) return 5;
  return 10;
}

function splitExecutiveRoles(roles: Array<[string, CabinetMember[]]>) {
  const minDisplayOrder = (members: CabinetMember[]) =>
    Math.min(...members.map((member) => member.display_order ?? Number.MAX_SAFE_INTEGER));

  const sorted = [...roles].sort((a, b) => {
    const byPriority = rolePriority(a[0]) - rolePriority(b[0]);
    if (byPriority !== 0) return byPriority;
    const byDisplayOrder = minDisplayOrder(a[1]) - minDisplayOrder(b[1]);
    if (byDisplayOrder !== 0) return byDisplayOrder;
    return a[0].localeCompare(b[0]);
  });

  const featured = sorted.filter(([role]) => rolePriority(role) <= 3);
  const supporting = sorted.filter(([role]) => rolePriority(role) > 3);

  return {
    featured: featured.length > 0 ? featured : sorted.slice(0, Math.min(sorted.length, 2)),
    supporting: featured.length > 0 ? supporting : sorted.slice(Math.min(sorted.length, 2)),
  };
}

// Staggered layout patterns — mirrors the gallery-memory-wall approach.
// Each pair sums to 12 cols so rows fill cleanly: (7+5), (5+7), (4+8), etc.
const EXEC_PATTERNS = [
  { span: 7, offset: '0px',  rotate: '-0.8deg', tapeX: '36%', tapeR: '-2deg'   },
  { span: 5, offset: '18px', rotate: '0.6deg',  tapeX: '62%', tapeR: '1.5deg'  },
  { span: 5, offset: '10px', rotate: '-0.5deg', tapeX: '42%', tapeR: '-1.5deg' },
  { span: 7, offset: '22px', rotate: '0.7deg',  tapeX: '65%', tapeR: '2deg'    },
];

const SUPPORTING_EXEC_PATTERNS = [
  { span: 7, offset: '0px',  rotate: '-0.6deg', tapeX: '45%', tapeR: '-1.5deg' },
  { span: 5, offset: '14px', rotate: '0.8deg',  tapeX: '55%', tapeR: '1deg'    },
  { span: 5, offset: '4px',  rotate: '-0.7deg', tapeX: '40%', tapeR: '-1deg'   },
  { span: 7, offset: '20px', rotate: '1.1deg',  tapeX: '60%', tapeR: '1.5deg'  },
];

const DEPT_PATTERNS = [
  { span: 7, offset: '0px',  rotate: '-1.2deg', tapeX: '38%', tapeR: '-2deg'   },
  { span: 5, offset: '28px', rotate: '0.9deg',  tapeX: '60%', tapeR: '1.5deg'  },
  { span: 4, offset: '12px', rotate: '1.1deg',  tapeX: '50%', tapeR: '1.2deg'  },
  { span: 8, offset: '32px', rotate: '-0.8deg', tapeX: '44%', tapeR: '-1.8deg' },
  { span: 6, offset: '16px', rotate: '0.6deg',  tapeX: '52%', tapeR: '1.5deg'  },
  { span: 6, offset: '4px',  rotate: '-1.1deg', tapeX: '46%', tapeR: '-1.2deg' },
];

const INTERN_PATTERNS = [
  { span: 4, offset: '0px',  rotate: '-1.4deg', tapeX: '50%', tapeR: '-2deg'   },
  { span: 4, offset: '12px', rotate: '1.2deg',  tapeX: '50%', tapeR: '1.5deg'  },
  { span: 4, offset: '6px',  rotate: '-0.9deg', tapeX: '50%', tapeR: '-1deg'   },
  { span: 3, offset: '22px', rotate: '1.5deg',  tapeX: '50%', tapeR: '2deg'    },
  { span: 3, offset: '2px',  rotate: '-1.1deg', tapeX: '50%', tapeR: '-1.5deg' },
  { span: 3, offset: '14px', rotate: '0.8deg',  tapeX: '50%', tapeR: '1.2deg'  },
  { span: 3, offset: '8px',  rotate: '-1.3deg', tapeX: '50%', tapeR: '-1deg'   },
];

type WallPattern = (typeof DEPT_PATTERNS)[number];

function cabCardStyle(idx: number, patterns: WallPattern[], total: number, isFullWidth: boolean = false): CSSProperties {
  const p = (total === 1 || isFullWidth)
    ? { span: 12, offset: '0px', rotate: '-0.1deg', tapeX: '46%', tapeR: '-1deg' }
    : patterns[idx % patterns.length];
  return {
    '--cab-span':   String(p.span),
    '--cab-offset': p.offset,
    '--cab-rotate': p.rotate,
    '--tape-x':     p.tapeX,
    '--tape-r':     p.tapeR,
  } as CSSProperties;
}

function Avatar({
  image,
  name,
  size = 48,
  priority = false,
}: {
  image?: string | null;
  name: string;
  size?: number;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = resolveImageUrl(image);

  if (!imageUrl || hasError) {
    const initials = name
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const hue = (name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) * 137) % 360;

    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold border-2 border-[var(--color-surface)] shadow-sm"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.34,
          background: `hsl(${hue}, 42%, 88%)`,
          color: `hsl(${hue}, 52%, 34%)`,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={getSupabaseImageUrl(imageUrl, {
        width: size * 2,
        height: size * 2,
        resize: 'cover',
        quality: 75,
      })}
      srcSet={`${getSupabaseImageUrl(imageUrl, {
        width: size,
        height: size,
        resize: 'cover',
        quality: 75,
      })} 1x, ${getSupabaseImageUrl(imageUrl, {
        width: size * 2,
        height: size * 2,
        resize: 'cover',
        quality: 75,
      })} 2x`}
      alt={name}
      className="shrink-0 rounded-full object-cover border-2 border-[var(--color-surface)] shadow-sm"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setHasError(true)}
    />
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="scrapbook-score px-4 py-4">
      <p
        className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-text3)' }}
      >
        {label}
      </p>
      <p className="font-serif text-3xl leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
    </div>
  );
}

function ExecutiveRolePanel({
  role,
  members,
  className = '',
}: {
  role: string;
  members: CabinetMember[];
  className?: string;
}) {
  const isSingle = members.length === 1;

  return (
    <section
      className={`scrapbook-paper p-5 h-full ${className}`.trim()}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="mb-4 flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <p className="font-sans text-[15px] font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            {role}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
            {members.length} {members.length === 1 ? 'position' : 'positions'}
          </p>
        </div>
      </div>

      <div className={`flex flex-col gap-1 ${isSingle ? '' : 'sm:grid sm:grid-cols-2 sm:gap-4'}`}>
        {members.map((member, idx) => (
          <article
            key={member.id}
            className={`flex flex-col gap-3 py-3 ${!isSingle && idx < members.length ? 'sm:py-0' : ''} ${isSingle ? '' : (idx % 2 === 0 && idx < members.length - 1 ? 'border-b sm:border-b-0 sm:border-r sm:pr-4' : '')} ${isSingle && idx < members.length - 1 ? 'border-b' : ''}`}
            style={{ borderColor: 'var(--color-border2)' }}
          >
            <div className={`flex gap-4 ${isSingle ? 'items-center' : 'flex-col sm:flex-row sm:items-start'}`}>
              <Avatar image={getCabinetPhotoUrl(member)} name={member.name} size={isSingle ? 64 : 56} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[14.5px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                  {member.name}
                </p>
                {formatMeta(member) && (
                  <p className="mt-1 font-sans text-[10.5px] font-medium leading-tight" style={{ color: 'var(--color-text2)' }}>
                    {formatMeta(member)}
                  </p>
                )}
                {(member.pronouns || member.favorite_snack) && (
                  <p className="mt-1.5 font-sans text-[10px] opacity-80" style={{ color: 'var(--color-text3)' }}>
                    {[member.pronouns, member.favorite_snack && `Snack: ${member.favorite_snack}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {member.fun_fact && (
              <div
                className="rounded-lg bg-[var(--color-surface2)] p-2.5 font-sans text-[11px] italic leading-relaxed"
                style={{ color: 'var(--color-text2)' }}
              >
                "{member.fun_fact}"
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ExecutiveFeaturePanel({ role, members }: { role: string; members: CabinetMember[] }) {
  const isPresident = rolePriority(role) === 0;

  return (
    <section
      className="scrapbook-paper overflow-hidden"
      style={{
        borderColor: isPresident ? 'var(--tape-teal)' : 'var(--color-border)',
        background: 'var(--color-surface)',
        borderWidth: isPresident ? '2px' : '1px',
      }}
    >
      <span className="scrapbook-pin" aria-hidden />
      <div
        className="border-b px-6 py-5"
        style={{
          borderColor: 'var(--color-border)',
          background: isPresident
            ? 'linear-gradient(135deg, rgba(30,136,120,0.12) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(30,136,120,0.06) 0%, transparent 60%)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
            {isPresident ? 'Executive Lead' : 'Executive Core'}
          </div>
          {isPresident && (
            <div className="h-1 w-1 rounded-full bg-brand-500 animate-pulse" />
          )}
        </div>
        <span className={`scrapbook-sticker ${isPresident ? 'scrapbook-sticker-teal scale-110 origin-left' : 'scrapbook-sticker-teal'}`}>
          {role}
        </span>
      </div>

      <div className={`grid gap-0 ${members.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {members.map((member, index) => (
          <article
            key={member.id}
            className={`p-6 ${members.length > 1 && index % 2 === 1 ? 'lg:border-l' : ''} ${index > 0 ? 'border-t lg:border-t-0' : ''}`}
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
              <div className="relative shrink-0">
                <Avatar image={getCabinetPhotoUrl(member)} name={member.name} size={isPresident ? 112 : 104} priority={index < 2} />
                {isPresident && (
                  <div className="absolute -bottom-2 -right-1 rounded-full bg-[var(--color-surface)] p-1 shadow-sm border border-[var(--color-border)]">
                    <div className="rounded-full bg-teal-500/10 p-1 text-teal-600 dark:text-teal-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`${isPresident ? 'font-serif text-[24px]' : 'font-serif text-[22px]'} font-bold tracking-tight leading-tight`}
                  style={{ color: 'var(--color-text)' }}
                >
                  {member.name}
                </p>
                {member.pronouns && (
                  <p className="mt-0.5 font-sans text-[11px] font-medium opacity-70" style={{ color: 'var(--color-text3)' }}>
                    {member.pronouns}
                  </p>
                )}
                {formatMeta(member) && (
                  <p className="mt-2.5 max-w-md font-sans text-[13px] font-medium leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    {formatMeta(member)}
                  </p>
                )}
                {member.favorite_snack && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border2)] bg-[var(--color-surface2)] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-[var(--color-text3)]">
                    <span className="text-[12px]">🍿</span> {member.favorite_snack}
                  </div>
                )}
              </div>
            </div>

            {member.fun_fact && (
              <div
                className={`mt-5 relative ${isPresident ? 'p-5' : 'pt-4 border-t'}`}
                style={{ borderColor: 'var(--color-border)' }}
              >
                {isPresident && (
                  <div className="absolute inset-0 rounded-xl bg-teal-500/5 -z-10" />
                )}
                <p
                  className={`${isPresident ? 'font-serif text-[19px]' : 'font-serif text-[17px]'} italic leading-[1.5] tracking-tight`}
                  style={{ color: 'var(--color-text)' }}
                >
                  "{member.fun_fact}"
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function DeptSpreadCard({ role, members }: { role: string; members: CabinetMember[] }) {
  return (
    <section
      className="scrapbook-dept p-6"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className="mb-6 pb-4 border-b flex items-start justify-between gap-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <p className="font-serif text-xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            {role}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {members.map((member, idx) => (
          <article
            key={member.id}
            className={`py-4 ${idx < members.length - 1 ? 'border-b' : ''}`}
            style={{ borderColor: 'var(--color-border2)' }}
          >
            <div className="flex items-start gap-4">
              <Avatar image={getCabinetPhotoUrl(member)} name={member.name} size={60} />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[16px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                  {member.name}
                </p>
                <p className="mt-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-brand-600 dark:text-brand-400">
                  {member.role}
                </p>
                {formatMeta(member) && (
                  <p className="mt-2 font-sans text-[11px] leading-relaxed opacity-90" style={{ color: 'var(--color-text2)' }}>
                    {formatMeta(member)}
                  </p>
                )}
                {(member.pronouns || member.favorite_snack) && (
                  <p className="mt-1.5 font-sans text-[10px] opacity-70" style={{ color: 'var(--color-text3)' }}>
                    {[member.pronouns, member.favorite_snack && `🍿 ${member.favorite_snack}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {member.fun_fact && (
              <div
                className="mt-3 rounded-lg bg-[var(--color-surface2)] p-2.5 font-sans text-[11px] italic leading-relaxed"
                style={{ color: 'var(--color-text2)' }}
              >
                "{member.fun_fact}"
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function CompactMemberCard({ member, index }: { member: CabinetMember; index?: number }) {
  // Deterministic rotation
  const rotationClass = typeof index === 'number' ? (index % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right') : '';

  return (
    <motion.article
      variants={itemVariants}
      whileHover={{ y: -3 }}
      className={`scrapbook-paper p-4 transition-all scrapbook-hover-tilt ${rotationClass}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <span className="scrapbook-pin" aria-hidden />
      <div className="flex items-start gap-3">
        <Avatar image={getCabinetPhotoUrl(member)} name={member.name} size={44} />
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>
            {member.name}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {member.role}
          </p>
          {formatMeta(member) && (
            <p className="mt-1.5 font-sans text-[11px] leading-relaxed opacity-80" style={{ color: 'var(--color-text2)' }}>
              {formatMeta(member)}
            </p>
          )}
        </div>
      </div>

      {member.fun_fact && (
        <div className="mt-3 border-t pt-3 font-sans text-[11px] italic leading-relaxed opacity-70" style={{ borderColor: 'var(--color-border2)', color: 'var(--color-text2)' }}>
          "{member.fun_fact}"
        </div>
      )}
    </motion.article>
  );
}

function RookieTile({ member }: { member: CabinetMember }) {
  return (
    <article 
      className="scrapbook-paper h-full p-3 text-center transition-transform hover:scale-[1.03]"
      style={{ background: 'var(--color-surface)' }}
    >
      <div className="mx-auto mb-2 w-fit">
        <Avatar image={getCabinetPhotoUrl(member)} name={member.name} size={56} />
      </div>
      <p className="truncate font-serif text-[13px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
        {member.name}
      </p>
      {member.year && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.05em]" style={{ color: 'var(--color-text3)' }}>
          {member.year}
        </p>
      )}
      {member.college && (
        <p className="mt-0.5 truncate font-sans text-[10px] opacity-70" style={{ color: 'var(--color-text3)' }}>
          {member.college}
        </p>
      )}
    </article>
  );
}

export function Cabinet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year')?.trim() || null;
  const { cabinetYears, loading: loadingCabinetYears } = useCabinetYears();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const { data: yearIdsData, isLoading: loadingYearIds } = useCabinetMemberYearIds();
  const hasLegacyMembers = yearIdsData?.hasLegacyMembers ?? false;

  const cabinetYearsWithMembers = useMemo(
    () => cabinetYears.filter((year) => yearIdsData?.yearIds?.includes(year.id) ?? false),
    [cabinetYears, yearIdsData]
  );
  const currentCabinetYear =
    cabinetYears.find((year) => year.is_active) ??
    cabinetYearsWithMembers[0] ??
    getCurrentCabinetYear(cabinetYears);
  const publicCabinetYears = useMemo(
    () => {
      const visibleYearIds = new Set(cabinetYearsWithMembers.map((year) => year.id));
      if (currentCabinetYear) visibleYearIds.add(currentCabinetYear.id);
      if (hasLegacyMembers && currentCabinetYear) visibleYearIds.add(currentCabinetYear.id);
      return cabinetYears.filter((year) => visibleYearIds.has(year.id));
    },
    [cabinetYears, cabinetYearsWithMembers, currentCabinetYear, hasLegacyMembers]
  );

  const requestedCabinetYear = useMemo(() => {
    if (!requestedYear || normalizeCabinetYearQuery(requestedYear) === 'current') return null;
    return publicCabinetYears.find((year) => cabinetYearMatchesQuery(year, requestedYear)) ?? null;
  }, [publicCabinetYears, requestedYear]);

  const isCurrentYearQuery = !!requestedYear && normalizeCabinetYearQuery(requestedYear) === 'current';
  const isInvalidYearQuery =
    !!requestedYear &&
    !isCurrentYearQuery &&
    !requestedCabinetYear &&
    !loadingCabinetYears;
  const isResolvingYearQuery =
    !!requestedYear &&
    !isCurrentYearQuery &&
    !requestedCabinetYear &&
    loadingCabinetYears;

  const effectiveCabinetYearId =
    isInvalidYearQuery || isResolvingYearQuery
      ? null
      : requestedCabinetYear?.id ?? currentCabinetYear?.id ?? publicCabinetYears[0]?.id ?? null;
  const selectedCabinetYear =
    isInvalidYearQuery || isResolvingYearQuery
      ? null
      : publicCabinetYears.find((year) => year.id === effectiveCabinetYearId) ?? currentCabinetYear ?? publicCabinetYears[0] ?? null;
  const shouldIncludeLegacyMembers = !!effectiveCabinetYearId && currentCabinetYear?.id === effectiveCabinetYearId;

  useEffect(() => {
    if (!requestedYear || !currentCabinetYear) return;
    const matchedYear = isCurrentYearQuery
      ? currentCabinetYear
      : publicCabinetYears.find((year) => cabinetYearMatchesQuery(year, requestedYear));

    if (matchedYear?.id !== currentCabinetYear.id) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('year');
    setSearchParams(nextParams, { replace: true });
  }, [currentCabinetYear, isCurrentYearQuery, publicCabinetYears, requestedYear, searchParams, setSearchParams]);

  function handleCabinetYearChange(yearId: string) {
    const nextParams = new URLSearchParams(searchParams);
    const nextYear = publicCabinetYears.find((year) => year.id === yearId) ?? null;

    if (!nextYear || nextYear.id === currentCabinetYear?.id) {
      nextParams.delete('year');
    } else {
      nextParams.set('year', cabinetYearQueryValue(nextYear));
    }

    setCopyStatus('idle');
    setSearchParams(nextParams);
  }

  async function copyCurrentLink() {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    setCopyStatus('idle');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  const { data: members = [], isLoading: loadingMembers, error: membersError } = useCabinetMembers(
    effectiveCabinetYearId,
    shouldIncludeLegacyMembers,
  );

  const isDegraded = isSupabaseUnavailable(membersError);

  const execBoard = members.filter((member) => member.category === 'Executive Board');
  const genBoard = members.filter((member) => member.category === 'General Board');
  const interns = members.filter((member) => member.category === 'Interns');
  const other = members.filter(
    (member) => !['Executive Board', 'General Board', 'Interns'].includes(member.category),
  );

  const execRoles = groupByRole(execBoard);
  const generalRoles = groupByRole(genBoard);
  const { featured: featuredExecRoles, supporting: supportingExecRoles } = splitExecutiveRoles(execRoles);
  const allExecRoles = [...featuredExecRoles, ...supportingExecRoles];
  const isViewingArchive = !!selectedCabinetYear && selectedCabinetYear.id !== currentCabinetYear?.id;
  const selectedYearRange = formatCabinetYearRange(selectedCabinetYear);
  const selectorValue = selectedCabinetYear?.id ?? (isInvalidYearQuery ? '__not_found__' : '');

  return (
    <>
      <PageTitle title={isInvalidYearQuery ? 'Cabinet Year Not Found' : 'Cabinet'} />
      {isDegraded && <DegradedModeBanner sourceName="cabinet" />}

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">Yearbook</span>
          <p className="vsa-section-label mt-3">Leadership</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_320px] lg:items-end">
            <div>
              <h1 className="vsa-page-title">
                {isInvalidYearQuery ? (
                  <>
                    Cabinet year <em>not found</em>
                  </>
                ) : isResolvingYearQuery ? (
                  <>
                    Cabinet <em>Archive</em>
                  </>
                ) : isViewingArchive ? (
                  <>
                    Cabinet <em>Archive</em>
                  </>
                ) : (
                  <>
                    Current <em>Cabinet</em>
                  </>
                )}
              </h1>
              <p className="mt-4 max-w-2xl font-sans text-sm leading-relaxed sm:text-[15px]" style={{ color: 'var(--text2)' }}>
                {isInvalidYearQuery
                  ? 'Cabinet year not found. Choose another Cabinet year below or return to the current Cabinet.'
                  : isResolvingYearQuery
                    ? `Looking up the ${requestedYear} Cabinet archive.`
                  : isViewingArchive
                    ? `Viewing ${selectedYearRange} Cabinet. Browse the people who shaped that year of VSA at UCSD.`
                    : 'The current team behind VSA at UCSD. Meet the people planning events, building community, producing programs, and shaping the year from the inside out.'}
              </p>
              <p className="mt-3 font-sans text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
                {isInvalidYearQuery
                  ? `Requested year: ${requestedYear}`
                  : isResolvingYearQuery
                    ? `Requested year: ${requestedYear}`
                    : `${isViewingArchive ? 'Cabinet Archive' : 'Current Cabinet'} / ${selectedYearRange}${selectedCabinetYear?.theme_name ? ` / ${selectedCabinetYear.theme_name}` : ''} / ${members.length} members`}
              </p>
              {!isViewingArchive && members.length > 0 && (
                <a
                  href="#cabinet-role-explorer"
                  className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
                >
                  Explore cabinet roles ↓
                </a>
              )}
              {isInvalidYearQuery && (
                <Link
                  to="/cabinet"
                  className="mt-5 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  View current Cabinet
                </Link>
              )}
              {publicCabinetYears.length > 0 && (
                <div className="mt-5 max-w-xs">
                  <label
                    className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-text3)' }}
                  >
                    Cabinet Year
                  </label>
                  <select
                    value={selectorValue}
                    onChange={(event) => handleCabinetYearChange(event.target.value)}
                    className="scrapbook-select"
                  >
                    {isInvalidYearQuery && (
                      <option value="__not_found__" disabled>
                        Cabinet year not found
                      </option>
                    )}
                    {publicCabinetYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {formatCabinetYearRange(year)}{year.id === currentCabinetYear?.id ? ' (current)' : ' archive'}
                      </option>
                    ))}
                  </select>
                  {!isInvalidYearQuery && (
                    <button
                      type="button"
                      onClick={copyCurrentLink}
                      className="mt-2 rounded border px-3 py-1.5 font-sans text-[12px] font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                    >
                      {copyStatus === 'copied' ? 'Link copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy link'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatBlock label="Executive" value={execBoard.length} />
              <StatBlock label="General Board" value={genBoard.length} />
              <StatBlock label="Interns" value={interns.length} />
            </div>
          </div>
        </div>
      </div>

      {loadingCabinetYears || loadingYearIds || loadingMembers ? (
        <div className="flex justify-center px-5 py-24 sm:px-8 lg:px-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-brand-600" />
        </div>
      ) : isInvalidYearQuery ? (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div
            className="scrapbook-empty p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Cabinet year not found.
            </h2>
            <p className="mx-auto mt-3 max-w-lg font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Choose another Cabinet year above, or view the current Cabinet to see the active board.
            </p>
            <Link
              to="/cabinet"
              className="mt-6 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              View current Cabinet
            </Link>
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div
            className="scrapbook-empty p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              {publicCabinetYears.length === 0
                ? 'Cabinet information is being updated. Check back soon.'
                : `No cabinet members are listed for ${selectedCabinetYear?.label ?? 'this cabinet year'} yet.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          {/* ── EXECUTIVE BOARD — one cohesive staggered wall ── */}
          {execBoard.length > 0 && (
            <section className="mb-16">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="scrapbook-sticker scrapbook-sticker-teal">Executive Board</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {execBoard.length} {execBoard.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                    Leadership
                  </h2>
                  <p className="mt-1.5 max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    The people planning events, coordinating programs, and keeping VSA running week to week.
                  </p>
                </div>
              </div>

              {/* 1. Executive Leads (Priority 0 - Presidents) */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="mb-10"
              >
                {allExecRoles
                  .filter(([role]) => rolePriority(role) === 0)
                  .map(([role, roleMembers]) => (
                    <motion.div
                      key={role}
                      variants={itemVariants}
                      className="cabinet-card mx-auto"
                      style={cabCardStyle(0, EXEC_PATTERNS, 1, true)}
                    >
                      <ExecutiveFeaturePanel role={role} members={roleMembers} />
                    </motion.div>
                  ))}
              </motion.div>

              {/* 2. Supporting Executive Roles (VPs, ICC, Sec, Treas) */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="cabinet-wall"
              >
                {allExecRoles
                  .filter(([role]) => rolePriority(role) > 0)
                  .map(([role, roleMembers], idx) => (
                    <motion.div
                      key={role}
                      variants={itemVariants}
                      className="cabinet-card"
                      style={cabCardStyle(idx, SUPPORTING_EXEC_PATTERNS, allExecRoles.length - 1)}
                    >
                      {rolePriority(role) <= 3 ? (
                        <ExecutiveFeaturePanel role={role} members={roleMembers} />
                      ) : (
                        <ExecutiveRolePanel role={role} members={roleMembers} />
                      )}
                    </motion.div>
                  ))}
              </motion.div>
            </section>
          )}

          {/* ── GENERAL BOARD — staggered department wall ── */}
          {genBoard.length > 0 && (
            <section className="mb-16 border-t pt-14" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="scrapbook-sticker scrapbook-sticker-coral">General Board</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {genBoard.length} {genBoard.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                    The Teams
                  </h2>
                  <p className="mt-1.5 max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    Program leads, creatives, and planners carrying each initiative from idea to execution.
                  </p>
                </div>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="cabinet-wall"
              >
                {generalRoles.map(([role, roleMembers], idx) => (
                  <motion.div
                    key={role}
                    variants={itemVariants}
                    className="cabinet-card"
                    style={cabCardStyle(idx, DEPT_PATTERNS, generalRoles.length)}
                  >
                    <DeptSpreadCard role={role} members={roleMembers} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* ── INTERNS — compact photo strip ── */}
          {interns.length > 0 && (
            <section className="mb-16 border-t pt-14" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="scrapbook-sticker scrapbook-sticker-gold">Interns</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {interns.length} {interns.length === 1 ? 'intern' : 'interns'}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                    Interns
                  </h2>
                  <p className="mt-1.5 max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    New leaders learning the ropes, supporting execution, and building toward future cabinet roles.
                  </p>
                </div>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="cabinet-wall"
              >
                {interns.map((member, idx) => (
                  <motion.div
                    key={member.id}
                    variants={itemVariants}
                    className="cabinet-card"
                    style={cabCardStyle(idx, INTERN_PATTERNS, interns.length)}
                  >
                    <RookieTile member={member} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* ── OTHER LEADERSHIP ── */}
          {other.length > 0 && (
            <section className="border-t pt-12" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-6">
                <span className="scrapbook-sticker">Other Leadership</span>
                <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Additional contributors and specialty roles supporting the organization across the year.
                </p>
              </div>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {other.map((member, index) => (
                  <CompactMemberCard key={member.id} member={member} index={index} />
                ))}
              </motion.div>
            </section>
          )}

          {!isViewingArchive && (
            <div
              id="cabinet-role-explorer"
              className="mt-16 scroll-mt-24 border-t pt-10"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <CabinetRoleExplorer />
              <section className="mt-12 text-center">
                <span className="scrapbook-sticker scrapbook-sticker-coral mb-3 inline-block">Join Cabinet</span>
                <div className="flex justify-center">
                  <ApplicationCTA
                    applicationKeys="cabinet_application"
                    fallback={{ closed: 'Cabinet applications have closed. Check back next year.' }}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
