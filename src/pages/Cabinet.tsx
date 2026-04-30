import { useEffect, useState } from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabase';

interface CabinetMember {
  id: string;
  name: string;
  role: string;
  category: string;
  display_order: number;
  image_url: string | null;
  year: string | null;
  college: string | null;
  major: string | null;
  minor: string | null;
  pronouns: string | null;
  favorite_snack: string | null;
  fun_fact: string | null;
}

const publicUrl = process.env.PUBLIC_URL || '';
const cabinetImage = (fileName: string) => `${publicUrl}/images/cabinet/${fileName}`;

function resolveImageUrl(image?: string | null) {
  if (!image) return null;
  return image.startsWith('http') || image.startsWith('data:') ? image : cabinetImage(image);
}

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

function rolePriority(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes('president')) return 0;
  if (normalized.includes('internal vice president')) return 1;
  if (normalized.includes('external vice president')) return 2;
  if (normalized.includes('vice president')) return 3;
  if (normalized.includes('secretary')) return 4;
  if (normalized.includes('treasurer')) return 5;
  return 10;
}

function splitExecutiveRoles(roles: Array<[string, CabinetMember[]]>) {
  const sorted = [...roles].sort((a, b) => {
    const byPriority = rolePriority(a[0]) - rolePriority(b[0]);
    if (byPriority !== 0) return byPriority;
    return a[0].localeCompare(b[0]);
  });

  const featured = sorted.filter(([role]) => rolePriority(role) <= 3);
  const supporting = sorted.filter(([role]) => rolePriority(role) > 3);

  return {
    featured: featured.length > 0 ? featured : sorted.slice(0, Math.min(sorted.length, 2)),
    supporting: featured.length > 0 ? supporting : sorted.slice(Math.min(sorted.length, 2)),
  };
}

function Avatar({
  image,
  name,
  size = 48,
}: {
  image?: string | null;
  name: string;
  size?: number;
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
        className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold"
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
      src={imageUrl}
      alt={name}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-md border px-4 py-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
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

function SectionHeading({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Label className="text-brand-600 dark:text-brand-400">{title}</Label>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          {subtitle}
        </p>
      </div>
      <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
        {count} {count === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
}

function ExecutiveRolePanel({ role, members }: { role: string; members: CabinetMember[] }) {
  return (
    <section
      className="rounded-md border p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="mb-5 flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <p className="font-sans text-lg font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
            {role}
          </p>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {members.length} {members.length === 1 ? 'person' : 'people'}
          </p>
        </div>
      </div>

      <div className={`grid gap-5 ${members.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {members.map((member) => (
          <article
            key={member.id}
            className="rounded-md border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
          >
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
              <Avatar image={member.image_url} name={member.name} size={72} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[15px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                  {member.name}
                </p>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600 dark:text-brand-400">
                  {member.role}
                </p>
                {formatMeta(member) && (
                  <p className="mt-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    {formatMeta(member)}
                  </p>
                )}
                {(member.pronouns || member.favorite_snack) && (
                  <p className="mt-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    {[member.pronouns, member.favorite_snack && `Snack: ${member.favorite_snack}`]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                )}
              </div>
            </div>

            {member.fun_fact && (
              <p
                className="mt-4 border-t pt-3 font-sans text-[12px] italic leading-relaxed"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
              >
                "{member.fun_fact}"
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ExecutiveFeaturePanel({ role, members }: { role: string; members: CabinetMember[] }) {
  return (
    <section
      className="rounded-md border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="border-b px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600 dark:text-brand-400">
          Executive Core
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <p className="font-serif text-[30px] leading-none tracking-[-0.03em]" style={{ color: 'var(--color-text)' }}>
              {role}
            </p>
            <p className="mt-2 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
              {members.length} {members.length === 1 ? 'leader' : 'leaders'}
            </p>
          </div>
        </div>
      </div>

      <div className={`grid gap-0 ${members.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {members.map((member, index) => (
          <article
            key={member.id}
            className={`p-6 ${members.length > 1 && index % 2 === 1 ? 'lg:border-l' : ''} ${index > 0 ? 'border-t lg:border-t-0' : ''}`}
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
              <Avatar image={member.image_url} name={member.name} size={96} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[20px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
                  {member.name}
                </p>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
                  {member.role}
                </p>
                {formatMeta(member) && (
                  <p className="mt-3 max-w-md font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    {formatMeta(member)}
                  </p>
                )}
                {(member.pronouns || member.favorite_snack) && (
                  <p className="mt-3 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                    {[member.pronouns, member.favorite_snack && `Snack: ${member.favorite_snack}`]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                )}
              </div>
            </div>

            {member.fun_fact && (
              <p
                className="mt-5 border-t pt-4 font-serif text-[18px] italic leading-[1.45] tracking-[-0.01em]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
              >
                "{member.fun_fact}"
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function RoleListPanel({ role, members }: { role: string; members: CabinetMember[] }) {
  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
        <p className="font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
          {role}
        </p>
        <span className="font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>
          {members.length}
        </span>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <article key={member.id} className="flex items-start gap-3">
            <Avatar image={member.image_url} name={member.name} size={34} />
            <div className="min-w-0">
              <p className="font-sans text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
                {member.name}
              </p>
              {formatMeta(member) && (
                <p className="mt-0.5 font-sans text-[11px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                  {formatMeta(member)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompactMemberCard({ member }: { member: CabinetMember }) {
  return (
    <article
      className="rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-start gap-3">
        <Avatar image={member.image_url} name={member.name} size={38} />
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
            {member.name}
          </p>
          <p className="mt-0.5 font-sans text-[11px]" style={{ color: 'var(--color-text2)' }}>
            {member.role}
          </p>
          {formatMeta(member) && (
            <p className="mt-1 font-sans text-[11px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
              {formatMeta(member)}
            </p>
          )}
        </div>
      </div>

      {member.fun_fact && (
        <p className="mt-3 border-t pt-3 font-sans text-[11px] italic leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
          "{member.fun_fact}"
        </p>
      )}
    </article>
  );
}

export function Cabinet() {
  const [members, setMembers] = useState<CabinetMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('cabinet_members')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setMembers(data as CabinetMember[]);
        setLoading(false);
      });
  }, []);

  const execBoard = members.filter((member) => member.category === 'Executive Board');
  const genBoard = members.filter((member) => member.category === 'General Board');
  const interns = members.filter((member) => member.category === 'Interns');
  const other = members.filter(
    (member) => !['Executive Board', 'General Board', 'Interns'].includes(member.category),
  );

  const execRoles = groupByRole(execBoard);
  const generalRoles = groupByRole(genBoard);
  const { featured: featuredExecRoles, supporting: supportingExecRoles } = splitExecutiveRoles(execRoles);

  return (
    <>
      <PageTitle title="Cabinet" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Label className="text-[var(--accent)]">Leadership</Label>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_320px] lg:items-end">
            <div>
              <h1 className="vsa-page-title">
                Cabinet <em>2025-26</em>
              </h1>
              <p className="mt-4 max-w-2xl font-sans text-sm leading-relaxed sm:text-[15px]" style={{ color: 'var(--text2)' }}>
                The team behind VSA at UCSD. Meet the people planning events, building community,
                producing programs, and shaping the year from the inside out.
              </p>
              <p className="mt-3 font-sans text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
                2025-2026 / Mi Xao Moggers / {members.length} members
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatBlock label="Executive" value={execBoard.length} />
              <StatBlock label="General Board" value={genBoard.length} />
              <StatBlock label="Interns" value={interns.length} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center px-5 py-24 sm:px-8 lg:px-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-brand-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div
            className="rounded-md border p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              Cabinet information is being updated. Check back soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          {execBoard.length > 0 && (
            <section className="mb-12">
              <SectionHeading
                title="Executive Board"
                subtitle="The core leadership team guiding VSA strategy, operations, and the rhythm of the year."
                count={execBoard.length}
              />
              <div className="space-y-6">
                {featuredExecRoles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div>
                        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                          Leadership Tier
                        </p>
                        <p className="mt-1 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                          Presidents and vice presidents are surfaced first so the structure reads more clearly.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-5">
                      {featuredExecRoles.map(([role, roleMembers]) => (
                        <ExecutiveFeaturePanel key={role} role={role} members={roleMembers} />
                      ))}
                    </div>
                  </div>
                )}

                {supportingExecRoles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div>
                        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                          Operations Tier
                        </p>
                        <p className="mt-1 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                          Supporting exec roles responsible for execution, continuity, and internal operations.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {supportingExecRoles.map(([role, roleMembers]) => (
                        <ExecutiveRolePanel key={role} role={role} members={roleMembers} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {genBoard.length > 0 && (
            <section className="mb-12 border-t pt-10" style={{ borderColor: 'var(--color-border)' }}>
              <SectionHeading
                title="General Board"
                subtitle="Program leads, creatives, and planners carrying each initiative from idea to execution."
                count={genBoard.length}
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {generalRoles.map(([role, roleMembers]) => (
                  <RoleListPanel key={role} role={role} members={roleMembers} />
                ))}
              </div>
            </section>
          )}

          {interns.length > 0 && (
            <section className="mb-12 border-t pt-10" style={{ borderColor: 'var(--color-border)' }}>
              <SectionHeading
                title="Interns"
                subtitle="New leaders learning the ropes, supporting execution, and building toward future cabinet roles."
                count={interns.length}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {interns.map((member) => (
                  <CompactMemberCard key={member.id} member={member} />
                ))}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section className="border-t pt-10" style={{ borderColor: 'var(--color-border)' }}>
              <SectionHeading
                title="Other Leadership"
                subtitle="Additional contributors and specialty roles that support the organization across the year."
                count={other.length}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {other.map((member) => (
                  <CompactMemberCard key={member.id} member={member} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
