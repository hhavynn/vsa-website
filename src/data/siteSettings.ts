export const SITE_SETTINGS_ID = 'global';

export interface SiteSettings {
  logoUrl: string;
  logoAlt: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  logoUrl: '',
  logoAlt: 'VSA at UC San Diego',
};
