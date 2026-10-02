import { ExternalEvent, UVSASchool } from "../types";

export const OWN_LOGO_URL =
  "https://test.supabase.co/storage/v1/object/public/uvsa_school_assets/ucsd/logo-1.webp";

export function makeSchool(overrides: Partial<UVSASchool> = {}): UVSASchool {
  return {
    id: "school-1",
    school_name: "University of California, San Diego",
    short_name: "UCSD",
    slug: "ucsd",
    system_type: "UC",
    city: "La Jolla",
    vsa_name: "VSA at UCSD",
    instagram_url: "https://www.instagram.com/vsaatucsd/",
    linktree_url: "https://linktr.ee/vsaatucsd",
    website_url: "https://vsa.ucsd.edu",
    facebook_url: "https://facebook.com/vsaatucsd",
    youtube_url: null,
    tiktok_url: null,
    description: "Home of Wild N Culture.",
    known_for: ["Wild N Culture"],
    recurring_events: ["GBMs"],
    logo_url: null,
    image_url: null,
    is_active: true,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeEvent(
  overrides: Partial<ExternalEvent> = {},
): ExternalEvent {
  return {
    id: "event-1",
    uvsa_school_id: "school-2",
    title: "Sample External",
    event_type: "Pageant",
    date: "2026-11-14",
    academic_term_id: null,
    location: "Irvine, CA",
    description: "A night of performances.",
    points: 4,
    rsvp_url: "https://example.com/rsvp",
    ride_form_url: null,
    instagram_url: null,
    host_info_url: null,
    ride_info: null,
    status: "upcoming",
    photo_album_url: null,
    recap: null,
    is_featured: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    uvsa_school: makeSchool({
      id: "school-2",
      slug: "uci",
      short_name: "UCI",
      vsa_name: "VSA at UCI",
      city: "Irvine",
    }),
    ...overrides,
  };
}
