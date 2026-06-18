import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cabinetRoles, CabinetRoleExplorerItem } from '../../../data/cabinetRoleExplorer';

type BoardGroup = CabinetRoleExplorerItem['boardGroup'];

const ALL_GROUPS: BoardGroup[] = [
  "Executive Board",
  "Programming & Member Experience",
  "Culture & External",
  "Media & Storytelling",
  "Finance & Operations"
];

function RoleCard({ role, expanded, onToggle }: { role: CabinetRoleExplorerItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border transition-all" style={{ borderColor: expanded ? 'var(--brand)' : 'var(--color-border)', background: 'var(--color-surface)' }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:p-5"
        aria-expanded={expanded}
      >
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>{role.roleName}</h4>
            {role.status === 'new' && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                Newer Role
              </span>
            )}
          </div>
          <p className="mt-1 font-sans text-sm leading-snug" style={{ color: 'var(--color-text2)' }}>
            {role.shortDescription}
          </p>
        </div>
        <div className="ml-4 shrink-0 rounded-full p-2 transition-colors" style={{ background: 'var(--color-surface2)', color: 'var(--color-text3)' }}>
          <svg
            className={`h-4 w-4 transform transition-transform duration-200 ${expanded ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t p-4 sm:p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Responsibilities</h5>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 font-sans text-sm" style={{ color: 'var(--color-text)' }}>
                    {role.responsibilities.map((req, i) => <li key={i}>{req}</li>)}
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Skills Built</h5>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {role.skillsBuilt.map((skill) => (
                        <span key={skill} className="rounded border px-2 py-0.5 font-sans text-[11px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text2)' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Works Closely With</h5>
                    <p className="mt-1 font-sans text-sm" style={{ color: 'var(--color-text)' }}>{role.worksWith.join(', ')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg p-4" style={{ background: 'var(--color-surface2)' }}>
                <h5 className="font-sans text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Great Fit If...</h5>
                <ul className="mt-2 list-inside list-disc space-y-1 font-sans text-sm" style={{ color: 'var(--color-text)' }}>
                  {role.bestFitFor.map((fit, i) => <li key={i}>{fit}</li>)}
                </ul>
              </div>

              {role.historyNote && (
                <p className="mt-4 font-sans text-xs italic" style={{ color: 'var(--color-text3)' }}>
                  * {role.historyNote}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CabinetRoleExplorer() {
  const [activeGroup, setActiveGroup] = useState<BoardGroup | 'All'>('All');
  const [expandedRoleSlug, setExpandedRoleSlug] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    let roles = [...cabinetRoles].sort((a, b) => a.displayOrder - b.displayOrder);
    if (activeGroup !== 'All') {
      roles = roles.filter(r => r.boardGroup === activeGroup);
    }
    return roles;
  }, [activeGroup]);

  return (
    <section className="mx-auto mt-16 max-w-5xl px-4 sm:mt-24 sm:px-6 lg:px-8">
      <div className="mb-8 text-center sm:mb-12">
        <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>Explore Cabinet Roles</h2>
        <p className="mx-auto mt-3 max-w-2xl font-sans text-base leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          Curious what cabinet actually does? Learn what each role works on, what skills it builds, and where you might fit.
        </p>
      </div>

      <div className="mb-10 rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Which role sounds like you?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like planning events”</span> → Events</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I care about mentorship”</span> → ACE, IVP, CRC</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like culture/community”</span> → CPC, VCN</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like external relations”</span> → EVP/ICC</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like design/social media”</span> → Media</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like filming/editing”</span> → PR, Historian</div>
          <div className="text-sm"><span className="font-bold text-brand-600 dark:text-brand-400">“I like money/logistics”</span> → Treasurer, Fundraising, Secretary</div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setActiveGroup('All')}
          className={`rounded-full px-4 py-1.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
            activeGroup === 'All'
              ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-zinc-950'
              : 'border bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
          }`}
          style={{ borderColor: activeGroup === 'All' ? 'transparent' : 'var(--color-border)' }}
        >
          All Roles
        </button>
        {ALL_GROUPS.map(group => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={`rounded-full px-4 py-1.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              activeGroup === group
                ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-zinc-950'
                : 'border bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
            }`}
            style={{ borderColor: activeGroup === group ? 'transparent' : 'var(--color-border)' }}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredRoles.map((role) => (
          <RoleCard
            key={role.roleSlug}
            role={role}
            expanded={expandedRoleSlug === role.roleSlug}
            onToggle={() => setExpandedRoleSlug(prev => prev === role.roleSlug ? null : role.roleSlug)}
          />
        ))}
      </div>
    </section>
  );
}