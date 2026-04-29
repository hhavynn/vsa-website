import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID, SiteSettings } from '../data/siteSettings';

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: true,
  refresh: async () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('logo_url, logo_alt')
        .eq('id', SITE_SETTINGS_ID)
        .single();

      if (data) {
        setSettings({
          logoUrl: data.logo_url || '',
          logoAlt: data.logo_alt || DEFAULT_SITE_SETTINGS.logoAlt,
        });
      }
    } catch {
      // Table may not exist yet — silently use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
