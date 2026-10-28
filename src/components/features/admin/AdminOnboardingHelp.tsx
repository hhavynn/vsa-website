import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminNavItemFor } from '../../../lib/adminNavigation';
import { useResourceLinks } from '../../../hooks/useResourceLinks';
import type { ResourceLink } from '../../../types';

const PROTECTED: Record<string, string> = {
  '/admin/import': 'Attendance imports may change member event history and points. Review identity matches and preview the import before confirming.',
  '/admin/points': 'Individual and House points have separate calculation rules. Never edit totals to make an archive look correct.',
  '/admin/members': 'Member profiles and aliases affect attendance matching. Confirm identity before merging or editing.',
  '/admin/merge-suggestions': 'Member merges are difficult to reverse and affect points/history. Verify the exact target before confirming.',
  '/admin/houses': 'House membership, assignments, and reveal timing are protected. Do not experiment with real rosters.',
  '/admin/ace': 'ACE family/lineage relationships are private until explicitly approved for publication.',
  '/admin/years': 'Academic term activation changes what is considered current; preserve previous-year archives.',
  '/admin/applications': 'An open application is live immediately. Double-check the Pacific time window and target link.',
};

const WORKFLOWS = [
  { title: 'Publish an event', description: 'Check the date, location, image, public visibility and check-in permissions.', to: '/admin/events' },
  { title: 'Add approved gallery photos', description: 'Confirm consent, use an approved image and link the album to the right event.', to: '/admin/gallery' },
  { title: 'Open an application window', description: 'Use Pacific time, verify the correct form, and test its public open/closed state.', to: '/admin/applications' },
  { title: 'Import event attendance', description: 'Protected: preview CSV matches and unresolved people; never blindly apply imports.', to: '/admin/import' },
  { title: 'Update this year’s Cabinet', description: 'Select the correct cabinet year and verify publication before making it current.', to: '/admin/cabinet' },
] as const;

function safeResourceHref(resource: ResourceLink): string | null {
  try {
    const parsed = new URL(resource.url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function selectOnboardingResources(resources: ResourceLink[], page: string) {
  return resources
    .filter((resource) => resource.is_current && !resource.is_archived)
    .filter((resource) => resource.category === 'Transition Docs' || resource.workflow?.trim().toLowerCase() === 'onboarding')
    .filter((resource) => !resource.role || resource.role === 'All Cabinet')
    .filter((resource) => !resource.program || resource.program === page || resource.program === 'All')
    .map((resource) => ({ ...resource, safeUrl: safeResourceHref(resource) }))
    .filter((resource) => resource.safeUrl !== null);
}

function EditedGuidance({ page }: { page: string }) {
  const { resources, loading, error } = useResourceLinks();
  const links = selectOnboardingResources(resources, page);
  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-3">
      <h3 className="font-sans text-sm font-bold text-text-primary">Cabinet-edited guidance</h3>
      <p className="mt-1 font-sans text-xs text-text-secondary">
        Cabinet can update these resources in <Link to="/admin/resources" className="underline underline-offset-2">Resources Index</Link>
        {' '}under Transition Docs or workflow “onboarding.” Changes do not require redeploying the site.
      </p>
      {loading && <p className="mt-2 font-sans text-xs text-text-muted">Loading cabinet resources…</p>}
      {Boolean(error) && <p className="mt-2 font-sans text-xs text-text-muted">Resources unavailable. The quick guide above still works.</p>}
      {!loading && !error && links.length === 0 && (
        <p className="mt-2 font-sans text-xs text-text-muted">No current onboarding resources have been added yet.</p>
      )}
      {links.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {links.map((resource) => (
            <li key={resource.id}>
              <a
                href={resource.safeUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-h-11 rounded-md border border-[var(--color-border)] bg-surface p-3 font-sans text-sm font-semibold text-brand-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-300"
              >
                {resource.title}
                {resource.description && <span className="mt-1 block text-xs font-normal text-text-secondary no-underline">{resource.description}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Small, on-demand admin help for every admin route. Does not gate access and
 * only loads admin-only Resources when the person opens the guide.
 */
export function AdminOnboardingHelp() {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const item = adminNavItemFor(pathname);
  const warning = Object.entries(PROTECTED).find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1];

  return (
    <section aria-label="Admin guidance" className="border-b border-[var(--color-border)] bg-surface2 px-4 py-2 sm:px-6">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-guidance-panel"
        onClick={() => setExpanded((value) => !value)}
        className="min-h-10 rounded-md px-2 font-sans text-sm font-semibold text-brand-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-300"
      >
        {expanded ? 'Hide admin help' : 'New to admin? Help for this page'}
      </button>
      {expanded && (
        <div id="admin-guidance-panel" className="max-w-5xl pb-4" aria-label="Admin help details">
          <h2 className="font-serif text-lg font-bold text-text-primary">{item?.label ?? 'VSA Admin'}: what this page does</h2>
          <p className="mt-1 font-sans text-sm text-text-secondary">
            {item?.summary ?? 'Find tools, recent activity, and site-readiness checks from the dashboard.'}
          </p>
          {item?.affects && <p className="mt-1 font-sans text-xs text-text-muted">May affect: {item.affects}</p>}
          {warning && <p role="note" className="mt-3 rounded-lg border border-amber-500/50 bg-amber-50 p-3 font-sans text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100"><strong>Protected / high-impact:</strong> {warning}</p>}
          <h3 className="mt-4 font-sans text-sm font-bold text-text-primary">Common workflows</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOWS.map((workflow) => (
              <li key={workflow.to} className="rounded-lg border border-[var(--color-border)] bg-surface p-3">
                <Link to={workflow.to} className="font-sans text-sm font-semibold text-brand-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-300">{workflow.title}</Link>
                <p className="mt-1 font-sans text-xs leading-relaxed text-text-secondary">{workflow.description}</p>
              </li>
            ))}
          </ul>
          <EditedGuidance page={item?.label ?? 'All'} />
        </div>
      )}
    </section>
  );
}
