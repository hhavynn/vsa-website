import { useEffect } from 'react';

import { useRouteSeo } from '../../lib/seo/RouteSeoContext';
import { applyNonIndexableMetadata, applyRouteMetadata } from '../../lib/seo/metadata';

interface PageTitleProps {
  /**
   * Overrides the title from the public route manifest. Pages whose title is
   * genuinely dynamic (a House year, the current VCN show) pass it; every other
   * public page leaves it out so the manifest stays the single source of truth
   * for the title, description, canonical URL and share tags.
   */
  title?: string;
}

export function PageTitle({ title }: PageTitleProps) {
  const { route, pathname } = useRouteSeo();

  useEffect(() => {
    if (route) {
      applyRouteMetadata(route, title);
      return;
    }

    applyNonIndexableMetadata(pathname, title);
  }, [pathname, route, title]);

  return null;
}
