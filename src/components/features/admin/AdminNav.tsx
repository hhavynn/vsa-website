import { ReactNode, useEffect, useId, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { FiArrowLeft, FiChevronDown, FiStar, FiX } from '../../../lib/adminIcons';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminFavorites, useAdminNavExpansion } from '../../../hooks/useAdminNavPreferences';
import {
  ADMIN_NAV_GROUPS,
  AdminNavGroup,
  AdminNavItem,
  MAX_ADMIN_FAVORITES,
  activeAdminNavPath,
  adminNavGroupFor,
  adminNavItemFor,
} from '../../../lib/adminNavigation';
import { cn } from '../../../lib/utils';
import { QuickSearchButton } from './AdminQuickSearch';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])';

function ItemLink({
  item,
  active,
  focusable = true,
  onNavigate,
  className,
}: {
  item: AdminNavItem;
  active: boolean;
  focusable?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      tabIndex={focusable ? undefined : -1}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-[40px] min-w-0 flex-1 items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-[13px] transition-colors',
        FOCUS_RING,
        active
          ? 'bg-brand-50 font-semibold text-brand-800 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand-600 dark:bg-brand-900/40 dark:text-brand-100 dark:before:bg-brand-400'
          : 'font-medium text-text-secondary hover:bg-surface2 hover:text-text-primary',
        className,
      )}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function PinButton({
  item,
  pinned,
  disabled,
  focusable = true,
  onToggle,
}: {
  item: AdminNavItem;
  pinned: boolean;
  disabled: boolean;
  focusable?: boolean;
  onToggle: () => void;
}) {
  const label = pinned ? `Unpin ${item.label} from favorites` : disabled ? `Favorites are full (${MAX_ADMIN_FAVORITES}). Unpin one to add ${item.label}` : `Pin ${item.label} to favorites`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      disabled={disabled && !pinned}
      tabIndex={focusable ? undefined : -1}
      className={cn(
        'flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-opacity hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30',
        FOCUS_RING,
        pinned
          ? 'text-gold-600 opacity-100 dark:text-gold-400'
          : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60',
      )}
    >
      <FiStar aria-hidden className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
    </button>
  );
}

function NavGroupSection({
  group,
  expanded,
  onToggle,
  activePath,
  favorites,
  isFavorite,
  isFull,
  onFavorite,
  onNavigate,
}: {
  group: AdminNavGroup;
  expanded: boolean;
  onToggle: () => void;
  activePath: string | null;
  favorites: readonly string[];
  isFavorite: (to: string) => boolean;
  isFull: boolean;
  onFavorite: (to: string) => void;
  onNavigate?: () => void;
}) {
  const panelId = useId();
  const Icon = group.icon;
  const holdsActive = group.items.some((item) => item.to === activePath);
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          'flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 py-2 text-left font-sans text-[13px] font-semibold transition-colors hover:bg-surface2',
          FOCUS_RING,
          holdsActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        )}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{group.group}</span>
        {holdsActive && !expanded && (
          <>
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400" />
            <span className="sr-only">(contains the current page)</span>
          </>
        )}
        <FiChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        className={cn('grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className={cn('overflow-hidden transition-[visibility] duration-200 motion-reduce:transition-none', !expanded && 'invisible')} aria-hidden={!expanded}>
          <ul className="ml-[18px] space-y-0.5 border-l border-[var(--color-border)] py-1 pl-1.5">
            {group.items.map((item) => (
              <li key={item.to} className="group flex items-center">
                <ItemLink item={item} active={item.to === activePath} focusable={expanded} onNavigate={onNavigate} />
                <PinButton
                  item={item}
                  pinned={isFavorite(item.to)}
                  disabled={isFull && !favorites.includes(item.to)}
                  focusable={expanded}
                  onToggle={() => onFavorite(item.to)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

type Preferences = ReturnType<typeof useAdminFavorites>;
type Expansion = ReturnType<typeof useAdminNavExpansion>;

function NavPanel({
  variant,
  activePath,
  preferences,
  expansion,
  onClose,
  onSearch,
}: {
  variant: 'desktop' | 'drawer';
  activePath: string | null;
  preferences: Preferences;
  expansion: Expansion;
  onClose?: () => void;
  onSearch?: () => void;
}) {
  const { user } = useAuth();

  const dashboard = ADMIN_NAV_GROUPS[0].items[0];
  const favoriteItems = preferences.favorites.map((to) => adminNavItemFor(to)).filter((item): item is AdminNavItem => Boolean(item));
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <div className="min-w-0">
          <div className="font-sans text-[13px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">VSA Admin</div>
          <div className="mt-0.5 font-sans text-[11px] text-text-muted">Cabinet tools</div>
        </div>
        {variant === 'drawer' && onClose && (
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="Close navigation"
            className={cn('flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-border)] bg-surface2 text-text-secondary hover:text-text-primary', FOCUS_RING)}
          >
            <FiX aria-hidden className="h-5 w-5" />
          </button>
        )}
      </div>

      {onSearch && (
        <div className="px-3 pt-3">
          <QuickSearchButton
            className="min-h-[40px]"
            onOpen={() => {
              onClose?.();
              onSearch();
            }}
          />
        </div>
      )}

      <nav aria-label="Admin" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        <ItemLinkRow item={dashboard} active={dashboard.to === activePath} onNavigate={onClose} />

        <section aria-labelledby={`${variant}-favorites`}>
          <h2 id={`${variant}-favorites`} className="mb-1 flex items-center gap-1.5 px-3 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
            <FiStar aria-hidden className="h-3 w-3" /> Favorites
          </h2>
          {favoriteItems.length === 0 ? (
            <p className="px-3 py-1 font-sans text-xs leading-relaxed text-text-muted">
              Use the star beside any page to pin up to {MAX_ADMIN_FAVORITES} here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {favoriteItems.map((item) => (
                <li key={item.to} className="group flex items-center">
                  <ItemLink item={item} active={item.to === activePath} onNavigate={onClose} />
                  <PinButton item={item} pinned disabled={false} onToggle={() => preferences.toggle(item.to)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-0.5 border-t border-[var(--color-border)] pt-3">
          <h2 className="sr-only">All admin tools</h2>
          {ADMIN_NAV_GROUPS.filter((group) => group.group).map((group) => (
            <NavGroupSection
              key={group.id}
              group={group}
              expanded={expansion.isExpanded(group.id)}
              onToggle={() => expansion.toggle(group.id)}
              activePath={activePath}
              favorites={preferences.favorites}
              isFavorite={preferences.isFavorite}
              isFull={preferences.isFull}
              onFavorite={preferences.toggle}
              onNavigate={onClose}
            />
          ))}
        </div>
      </nav>

      <div className="space-y-2 border-t border-[var(--color-border)] bg-surface2 px-3 py-3">
        <Link
          to="/"
          onClick={onClose}
          className={cn('flex min-h-[36px] items-center gap-2 rounded-md px-2 font-sans text-[13px] font-medium text-text-secondary hover:text-text-primary', FOCUS_RING)}
        >
          <FiArrowLeft aria-hidden className="h-4 w-4" /> Back to vsaucsd.org
        </Link>
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-surface font-sans text-[10px] font-bold uppercase text-text-primary">
            {initials}
          </div>
          <div className="min-w-0 truncate font-sans text-xs text-text-muted" title={user?.email ?? undefined}>
            {user?.email ?? 'Signed in as admin'}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The Dashboard link: a top-level destination, not a collapsible group. */
function ItemLinkRow({ item, active, onNavigate }: { item: AdminNavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex items-center">
      <ItemLink item={item} active={active} onNavigate={onNavigate} className="font-semibold" />
    </div>
  );
}

function MobileDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // onClose identity changes every render in the parent; the listener only needs the latest call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" data-testid="admin-nav-backdrop" />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        initial={reduceMotion ? false : { x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        className="absolute inset-y-0 left-0 w-[min(320px,88vw)] border-r border-[var(--color-border)] bg-surface shadow-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The admin sidebar: a sticky, independently scrolling column on desktop and a
 * dialog drawer on mobile. Both render the same grouped, collapsible panel.
 * Presentation only: destinations come from lib/adminNavigation.ts, and access
 * is the <AdminRoute> boundary, never this component.
 */
export function AdminNav({ isOpen, onClose, onSearch }: { isOpen?: boolean; onClose?: () => void; onSearch?: () => void }) {
  const { pathname } = useLocation();
  const activePath = activeAdminNavPath(pathname);
  const activeGroup = activePath ? adminNavGroupFor(activePath) : null;
  // One copy of the preferences, shared by the desktop column and the drawer.
  const preferences = useAdminFavorites();
  const expansion = useAdminNavExpansion(activeGroup?.group ? activeGroup.id : null);
  return (
    <>
      <aside
        aria-label="Admin sidebar"
        className="sticky top-[60px] hidden h-[calc(100vh-60px)] w-[264px] shrink-0 self-start border-r border-[var(--color-border)] bg-surface md:block"
      >
        <NavPanel variant="desktop" activePath={activePath} preferences={preferences} expansion={expansion} onSearch={onSearch} />
      </aside>
      {isOpen && onClose && (
        <MobileDrawer onClose={onClose}>
          <NavPanel variant="drawer" activePath={activePath} preferences={preferences} expansion={expansion} onClose={onClose} onSearch={onSearch} />
        </MobileDrawer>
      )}
    </>
  );
}
