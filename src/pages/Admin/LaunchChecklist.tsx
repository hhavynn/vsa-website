import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';
import { getApplicationStatus } from '../../lib/applicationLinks';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus =
  | 'loading'
  | 'good'
  | 'needs_attention'
  | 'not_configured'
  | 'not_installed'
  | 'manual';

interface CheckData {
  status: CheckStatus;
  count?: number;
  note?: string;
}

interface ChecklistState {
  // Year & Term Setup
  activeTermExists: CheckData;
  activeCabinetYearExists: CheckData;
  // Cabinet
  cabinetMembersInActiveYear: CheckData;
  cabinetMissingPhotos: CheckData;
  // Events & Gallery
  publishedUpcomingEvents: CheckData;
  draftEvents: CheckData;
  galleryAlbums: CheckData;
  // VCN / Programs
  vcnCurrentPublished: CheckData;
  programContentEntries: CheckData;
  // Ask VSA
  aiSnippetsActive: CheckData;
  aiTableExists: boolean;
  // Applications
  applicationsOpen: CheckData;
  applicationsTotal: CheckData;
  applicationsTableExists: boolean;
}

const LOADING: CheckData = { status: 'loading' };

const DEFAULT_STATE: ChecklistState = {
  activeTermExists: LOADING,
  activeCabinetYearExists: LOADING,
  cabinetMembersInActiveYear: LOADING,
  cabinetMissingPhotos: LOADING,
  publishedUpcomingEvents: LOADING,
  draftEvents: LOADING,
  galleryAlbums: LOADING,
  vcnCurrentPublished: LOADING,
  programContentEntries: LOADING,
  aiSnippetsActive: LOADING,
  aiTableExists: false,
  applicationsOpen: LOADING,
  applicationsTotal: LOADING,
  applicationsTableExists: false,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
        style={{ background: 'var(--color-surface2)', color: 'var(--color-text3)' }}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        Loading
      </span>
    );
  }
  if (status === 'good') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Good
      </span>
    );
  }
  if (status === 'needs_attention') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Needs attention
      </span>
    );
  }
  if (status === 'not_configured') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Not configured
      </span>
    );
  }
  if (status === 'not_installed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
        style={{ background: 'var(--color-surface2)', color: 'var(--color-text3)' }}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Not installed
      </span>
    );
  }
  // manual
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Manual review
    </span>
  );
}

function CheckItem({
  label,
  data,
  link,
  forceStatus,
  note,
}: {
  label: string;
  data?: CheckData;
  link?: string;
  forceStatus?: CheckStatus;
  note?: string;
}) {
  const status = forceStatus ?? data?.status ?? 'loading';
  const count = data?.count;
  const itemNote = note ?? data?.note;

  const inner = (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors ${link ? 'hover:bg-[var(--color-surface2)] cursor-pointer' : ''}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[13px] font-medium leading-snug" style={{ color: 'var(--color-text)' }}>
          {label}
          {typeof count === 'number' && (
            <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
              ({count})
            </span>
          )}
        </p>
        {itemNote && (
          <p className="mt-0.5 font-sans text-[11px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            {itemNote}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <StatusBadge status={status} />
      </div>
    </div>
  );

  if (link) {
    return <Link to={link} className="block">{inner}</Link>;
  }
  return inner;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
      <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h2 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h2>
      </div>
      <div className="space-y-2 p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LaunchChecklist() {
  const [state, setState] = useState<ChecklistState>(DEFAULT_STATE);

  useEffect(() => {
    async function load() {
      const nowIso = new Date().toISOString();

      // ── 1. Academic terms ──────────────────────────────────────────────────
      const [activeTermsRes, totalTermsRes] = await Promise.all([
        supabase.from('academic_terms').select('id', { count: 'exact', head: true }).eq('is_current', true),
        supabase.from('academic_terms').select('id', { count: 'exact', head: true }),
      ]);

      const activeTermCount = activeTermsRes.count ?? 0;
      const activeTermExists: CheckData = activeTermsRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : activeTermCount > 0
          ? { status: 'good', count: activeTermCount }
          : { status: 'needs_attention', count: 0, note: 'No current term set' };

      // ── 2. Cabinet years ───────────────────────────────────────────────────
      const cabinetActiveYearRes = await supabase
        .from('cabinet_years')
        .select('id, label')
        .eq('is_active', true)
        .maybeSingle();

      const activeCabinetYear = cabinetActiveYearRes.data;
      const activeCabinetYearExists: CheckData = cabinetActiveYearRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : activeCabinetYear
          ? { status: 'good', note: activeCabinetYear.label }
          : { status: 'needs_attention', note: 'No active cabinet year found' };

      // ── 3. Cabinet members ─────────────────────────────────────────────────
      const [cabinetMembersRes, cabinetMissingPhotoRes] = await Promise.all([
        activeCabinetYear?.id
          ? supabase.from('cabinet_members').select('id', { count: 'exact', head: true }).eq('cabinet_year_id', activeCabinetYear.id)
          : Promise.resolve({ count: 0, error: null }),
        supabase.from('cabinet_members').select('id', { count: 'exact', head: true }).is('image_url', null),
      ]);

      const cabinetMembersInActiveYear: CheckData = cabinetMembersRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : !activeCabinetYear
          ? { status: 'needs_attention', note: 'No active cabinet year set' }
          : (cabinetMembersRes.count ?? 0) > 0
            ? { status: 'good', count: cabinetMembersRes.count ?? 0 }
            : { status: 'needs_attention', count: 0, note: 'Active year has no members' };

      const missingPhotoCount = cabinetMissingPhotoRes.count ?? 0;
      const cabinetMissingPhotos: CheckData = cabinetMissingPhotoRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : missingPhotoCount === 0
          ? { status: 'good', count: 0 }
          : { status: 'needs_attention', count: missingPhotoCount, note: 'Members across all years with no photo' };

      // ── 4. Events ──────────────────────────────────────────────────────────
      const [upcomingPublishedRes, draftRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_published', true).gte('date', nowIso),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_published', false),
      ]);

      const upcomingCount = upcomingPublishedRes.count ?? 0;
      const publishedUpcomingEvents: CheckData = upcomingPublishedRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : upcomingCount > 0
          ? { status: 'good', count: upcomingCount }
          : { status: 'needs_attention', count: 0, note: 'No upcoming published events' };

      const draftCount = draftRes.count ?? 0;
      const draftEvents: CheckData = draftRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : draftCount === 0
          ? { status: 'good', count: 0 }
          : { status: 'needs_attention', count: draftCount, note: 'Draft events not yet published' };

      // ── 5. Gallery ─────────────────────────────────────────────────────────
      const galleryRes = await supabase.from('gallery_events').select('id', { count: 'exact', head: true });
      const galleryAlbums: CheckData = galleryRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : (galleryRes.count ?? 0) > 0
          ? { status: 'good', count: galleryRes.count ?? 0 }
          : { status: 'needs_attention', count: 0, note: 'No gallery albums found' };

      // ── 6. VCN ─────────────────────────────────────────────────────────────
      const vcnRes = await supabase
        .from('vcn_archives')
        .select('id', { count: 'exact', head: true })
        .eq('is_current', true)
        .eq('is_published', true);

      const vcnCurrentPublished: CheckData = vcnRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : (vcnRes.count ?? 0) > 0
          ? { status: 'good' }
          : { status: 'needs_attention', note: 'No current published VCN archive set' };

      // ── 7. Program content ─────────────────────────────────────────────────
      const programRes = await supabase
        .from('program_content')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);

      const programContentEntries: CheckData = programRes.error
        ? { status: 'not_configured', note: 'Unable to load' }
        : (programRes.count ?? 0) > 0
          ? { status: 'good', count: programRes.count ?? 0 }
          : { status: 'needs_attention', count: 0, note: 'No published program content found' };

      // ── 8. AI knowledge (table may not exist) ─────────────────────────────
      let aiTableExists = false;
      let aiSnippetsActive: CheckData = { status: 'not_installed' };

      const aiRes = await (supabase.from('ai_knowledge_base' as any) as any)
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('is_active', true);

      if (!aiRes.error) {
        aiTableExists = true;
        const aiCount = aiRes.count ?? 0;
        aiSnippetsActive = aiCount > 0
          ? { status: 'good', count: aiCount }
          : { status: 'needs_attention', count: 0, note: 'No active public snippets' };
      }

      // ── 9. Applications (table may not exist) ──────────────────────────────
      let applicationsTableExists = false;
      let applicationsOpen: CheckData = { status: 'not_installed' };
      let applicationsTotal: CheckData = { status: 'not_installed' };

      const appsRes = await supabase
        .from('application_links')
        .select('open_at, due_at, is_enabled');

      if (!appsRes.error && appsRes.data) {
        applicationsTableExists = true;
        const nowDate = new Date();
        let openCount = 0;
        appsRes.data.forEach((row) => {
          const status = getApplicationStatus(row.open_at, row.due_at, row.is_enabled, nowDate);
          if (status === 'open') openCount += 1;
        });
        const total = appsRes.data.length;
        applicationsTotal = { status: total > 0 ? 'good' : 'needs_attention', count: total };
        applicationsOpen = openCount > 0
          ? { status: 'good', count: openCount }
          : { status: 'needs_attention', count: 0, note: 'No application windows currently open' };
      }

      // Suppress unused variable warning for totalTermsRes
      void totalTermsRes;

      setState({
        activeTermExists,
        activeCabinetYearExists,
        cabinetMembersInActiveYear,
        cabinetMissingPhotos,
        publishedUpcomingEvents,
        draftEvents,
        galleryAlbums,
        vcnCurrentPublished,
        programContentEntries,
        aiSnippetsActive,
        aiTableExists,
        applicationsOpen,
        applicationsTotal,
        applicationsTableExists,
      });
    }

    load();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Launch Checklist" />

      {/* Page header */}
      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
            Admin tools
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Launch Checklist
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Use this before each academic year to confirm public content, applications, cabinet, Houses, events, and Ask VSA are ready. Automated checks query live data. Manual review items require your judgment.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl space-y-6">

          {/* ── Year & Term Setup ── */}
          <Section title="Year & Term Setup">
            <CheckItem
              label="Active academic term exists"
              data={state.activeTermExists}
              link="/admin/years"
            />
            <CheckItem
              label="Current cabinet year is set"
              data={state.activeCabinetYearExists}
              link="/admin/years"
            />
            <CheckItem
              label="Review term label and date range look current"
              forceStatus="manual"
              link="/admin/years"
            />
          </Section>

          {/* ── Homepage & Presidents ── */}
          <Section title="Homepage & Presidents">
            <CheckItem
              label="Presidents content configured"
              data={state.programContentEntries}
              link="/admin/content"
            />
            <CheckItem
              label="Review president message is current for this year"
              forceStatus="manual"
              link="/admin/content"
            />
            <CheckItem
              label="Site settings configured (logo, theme)"
              forceStatus="manual"
              link="/admin/settings"
              note="Verify logo and site-wide settings before launch"
            />
          </Section>

          {/* ── Cabinet ── */}
          <Section title="Cabinet">
            <CheckItem
              label="Active cabinet year has members"
              data={state.cabinetMembersInActiveYear}
              link="/admin/cabinet"
            />
            <CheckItem
              label="Cabinet members missing photos"
              data={state.cabinetMissingPhotos}
              link="/admin/cabinet"
            />
            <CheckItem
              label="Review cabinet member roles and bios before launch"
              forceStatus="manual"
              link="/admin/cabinet"
            />
          </Section>

          {/* ── Applications ── */}
          <Section title="Applications">
            {state.applicationsTableExists ? (
              <>
                <CheckItem
                  label="Total application windows configured"
                  data={state.applicationsTotal}
                  link="/admin/applications"
                />
                <CheckItem
                  label="Application windows currently open"
                  data={state.applicationsOpen}
                  link="/admin/applications"
                />
                <CheckItem
                  label="Confirm open/close windows are set correctly for each program"
                  forceStatus="manual"
                  link="/admin/applications"
                />
              </>
            ) : (
              <CheckItem
                label="Application links table"
                forceStatus="not_installed"
                note="application_links table not found — skip if not in use"
              />
            )}
          </Section>

          {/* ── Houses ── */}
          <Section title="Houses">
            <CheckItem
              label="House assets exist for current year"
              forceStatus="manual"
              link="/admin/houses"
              note="Verify house_page_assets has entries for the current academic year"
            />
            <CheckItem
              label="Do not use placeholder House names for unrevealed years"
              forceStatus="manual"
              note="Never invent future House names — wait for the official reveal"
            />
            <CheckItem
              label="Confirm prior-year archive is not mixed with current year"
              forceStatus="manual"
              link="/admin/houses"
            />
          </Section>

          {/* ── Events & Gallery ── */}
          <Section title="Events & Gallery">
            <CheckItem
              label="Published upcoming events"
              data={state.publishedUpcomingEvents}
              link="/admin/events"
            />
            <CheckItem
              label="Draft events pending review"
              data={state.draftEvents}
              link="/admin/events"
            />
            <CheckItem
              label="Gallery albums"
              data={state.galleryAlbums}
              link="/admin/gallery"
            />
          </Section>

          {/* ── VCN / WNC / Programs ── */}
          <Section title="VCN / WNC / Programs">
            <CheckItem
              label="VCN current archive is published"
              data={state.vcnCurrentPublished}
              link="/admin/vcn"
            />
            <CheckItem
              label="Program content entries exist"
              data={state.programContentEntries}
              link="/admin/content"
            />
            <CheckItem
              label="Confirm WNC page has safe placeholder content"
              forceStatus="manual"
              link="/admin/content"
              note="Do not publish WNC program details prematurely"
            />
          </Section>

          {/* ── Ask VSA ── */}
          <Section title="Ask VSA">
            {state.aiTableExists ? (
              <>
                <CheckItem
                  label="Active AI knowledge snippets"
                  data={state.aiSnippetsActive}
                  link="/admin/ai-knowledge"
                />
                <CheckItem
                  label="Review snippets for accuracy before launch"
                  forceStatus="manual"
                  link="/admin/ai-knowledge"
                  note="Check that event details, dates, and program info are current"
                />
              </>
            ) : (
              <CheckItem
                label="Ask VSA knowledge table"
                forceStatus="not_installed"
                note="ai_knowledge_base table not found — skip if Ask VSA is not in use"
              />
            )}
          </Section>

          {/* ── Storage & Degraded Mode ── */}
          <Section title="Storage & Degraded Mode">
            <CheckItem
              label="Test fallback / degraded mode in staging before launch"
              forceStatus="manual"
            />
            <CheckItem
              label="Run storage egress audit if Supabase Storage URLs remain"
              forceStatus="manual"
              note="Use the Content Health Dashboard on the admin overview to count legacy storage URLs"
            />
          </Section>

          {/* ── Final Manual QA ── */}
          <Section title="Final Manual QA">
            <CheckItem
              label="Open homepage, events, points, leaderboard, house pages, cabinet, gallery, get involved"
              forceStatus="manual"
            />
            <CheckItem
              label="Test mobile navigation"
              forceStatus="manual"
            />
            <CheckItem
              label="Test Ask VSA unavailable state"
              forceStatus="manual"
            />
            <CheckItem
              label="Test application windows (open and closed behavior)"
              forceStatus="manual"
            />
            <CheckItem
              label="Confirm no private or admin data is visible on public routes"
              forceStatus="manual"
            />
          </Section>

          {/* Footer note */}
          <p className="pb-4 font-sans text-[11px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            Automated checks query live data read-only. Manual review items require human judgment and cannot be automated. This page does not write or modify any data.
          </p>

        </div>
      </div>
    </div>
  );
}
