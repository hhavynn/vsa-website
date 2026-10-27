// Per-browser admin sidebar preferences: pinned favorites and which groups are
// expanded. Stored in localStorage only: nothing is written to Supabase, and a
// blocked, full, or corrupted store falls back to the defaults instead of throwing.
import { useCallback, useEffect, useState } from 'react';
import {
  ADMIN_NAV_GROUPS,
  DEFAULT_ADMIN_FAVORITES,
  MAX_ADMIN_FAVORITES,
  sanitizeAdminFavorites,
} from '../lib/adminNavigation';

export const ADMIN_FAVORITES_STORAGE_KEY = 'vsa-admin-nav-favorites';
export const ADMIN_EXPANDED_STORAGE_KEY = 'vsa-admin-nav-expanded';

/** The group opened for someone who has never expanded one and is on the dashboard. */
const DEFAULT_EXPANDED_GROUP = 'events-attendance';

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; losing it must never break navigation.
  }
}

export function useAdminFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => sanitizeAdminFavorites(readJson(ADMIN_FAVORITES_STORAGE_KEY)) ?? [...DEFAULT_ADMIN_FAVORITES]);

  const toggle = useCallback((to: string) => {
    setFavorites((current) => {
      let next: string[];
      if (current.includes(to)) next = current.filter((entry) => entry !== to);
      else if (current.length >= MAX_ADMIN_FAVORITES) return current;
      else next = [...current, to];
      writeJson(ADMIN_FAVORITES_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return {
    favorites,
    isFavorite: (to: string) => favorites.includes(to),
    isFull: favorites.length >= MAX_ADMIN_FAVORITES,
    toggle,
  };
}

const KNOWN_GROUP_IDS = new Set(ADMIN_NAV_GROUPS.filter((group) => group.group).map((group) => group.id));

function readExpanded(): string[] | null {
  const stored = readJson(ADMIN_EXPANDED_STORAGE_KEY);
  if (!Array.isArray(stored)) return null;
  return stored.filter((id): id is string => typeof id === 'string' && KNOWN_GROUP_IDS.has(id));
}

/**
 * Which sidebar groups are open. The group holding the current page is always
 * opened when the route changes (so a direct link or search result never lands
 * on a collapsed section), and admins can open or close any other group freely.
 */
export function useAdminNavExpansion(activeGroupId: string | null) {
  const [expanded, setExpanded] = useState<string[]>(() => {
    const stored = readExpanded() ?? (activeGroupId ? [] : [DEFAULT_EXPANDED_GROUP]);
    return activeGroupId && !stored.includes(activeGroupId) ? [...stored, activeGroupId] : stored;
  });

  useEffect(() => {
    if (!activeGroupId) return;
    setExpanded((current) => {
      if (current.includes(activeGroupId)) return current;
      const next = [...current, activeGroupId];
      writeJson(ADMIN_EXPANDED_STORAGE_KEY, next);
      return next;
    });
  }, [activeGroupId]);

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      writeJson(ADMIN_EXPANDED_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { expanded, isExpanded: (id: string) => expanded.includes(id), toggle };
}
