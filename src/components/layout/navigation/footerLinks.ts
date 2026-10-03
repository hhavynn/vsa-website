import { wrappedNavLabel } from '../../../data/wrappedEdition';

// Footer-only link lists. These are a superset of the primary nav on purpose:
// the footer is where secondary destinations (calendar, personal points lookup,
// UVSA network) and legal/help links live without crowding the header or the
// 4-slot mobile dock. Genuine primary/global navigation stays in navConfig.ts.

export interface FooterLink {
  label: string;
  to: string;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: 'Navigate',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Events', to: '/events' },
      { label: 'Calendar', to: '/calendar' },
      { label: 'Cabinet', to: '/cabinet' },
      { label: 'Gallery', to: '/gallery' },
      { label: 'Leaderboard', to: '/leaderboard' },
      { label: 'Find My Points', to: '/points' },
      { label: wrappedNavLabel(), to: '/#wrapped' },
    ],
  },
  {
    title: 'Programs',
    links: [
      { label: 'Get Involved', to: '/get-involved' },
      { label: 'ACE', to: '/ace' },
      { label: 'House System', to: '/house-system' },
      { label: 'Intern Program', to: '/intern-program' },
      { label: 'VCN', to: '/vcn' },
      { label: "Wild n' Culture", to: '/wild-n-culture' },
      { label: 'UVSA Network', to: '/uvsa-network' },
    ],
  },
];

// Legal / help row at the very bottom of the footer.
export const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { label: 'Feedback', to: '/feedback' },
  { label: 'Privacy Notice', to: '/privacy' },
];
