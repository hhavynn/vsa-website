import { supabase } from "../../lib/supabase";
import { withErrorHandling } from "../errors";

export interface UVSANetworkPageSettings {
  id: string;
  hero_kicker: string;
  hero_title: string;
  hero_emphasis: string;
  hero_description: string;
  intro_heading: string;
  intro_body: string;
  intro_note: string;
  stat_school_count_label: string;
  stat_competitions_label: string;
  stat_community_label: string;
  upcoming_heading: string;
  showcase_heading: string;
  showcase_description: string;
  schools_heading: string;
  empty_state_title: string;
  empty_state_message: string;
  updated_at: string;
}

export type UVSANetworkPageSettingsInput = Omit<
  UVSANetworkPageSettings,
  "updated_at"
>;

export const DEFAULT_UVSA_NETWORK_PAGE_SETTINGS: UVSANetworkPageSettings = {
  id: "main",
  hero_kicker: "UVSA 101",
  hero_title: "SoCal VSA",
  hero_emphasis: "Network",
  hero_description:
    "13 schools. One community. VSA at UCSD is part of the larger UVSA SoCal network of students across Southern California.",
  intro_heading: "Externals",
  intro_body:
    "Externals are events hosted by other VSAs where UCSD members can attend, support, compete, and meet people from other schools. Externals can look like pageants, game shows, talent competitions, showcases, or performance nights, but they are also a way for schools to support each other's philanthropy projects and cultural programming.",
  intro_note:
    "Many externals are also tied to philanthropy, culture, or community causes. Some feel like big competitions or showcases, but they still help connect schools and support the values behind UVSA.",
  stat_school_count_label: "13 Schools",
  stat_competitions_label: "Competitions",
  stat_community_label: "VSA Community",
  upcoming_heading: "Upcoming Externals",
  showcase_heading: "2025-2026 External Showcase",
  showcase_description:
    "A look at the externals from the previous year. UCSD's Wild N' Culture is listed first as our home-hosted event. Many externals also connect to philanthropy and cultural programming at the hosting school.",
  schools_heading: "Explore the 13 Schools",
  empty_state_title:
    "Upcoming externals will be added once they are confirmed by VSA at UCSD and the host schools.",
  empty_state_message: "Check back soon for the upcoming season.",
  updated_at: "",
};

export class UVSANetworkSettingsRepository {
  async getSettings(): Promise<UVSANetworkPageSettings> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from("uvsa_network_page_settings")
        .select("*")
        .eq("id", "main")
        .maybeSingle();

      if (error) throw error;
      return data || DEFAULT_UVSA_NETWORK_PAGE_SETTINGS;
    }, "Failed to fetch UVSA network page settings");
  }

  async updateSettings(
    settings: UVSANetworkPageSettingsInput,
  ): Promise<UVSANetworkPageSettings> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from("uvsa_network_page_settings")
        .upsert(settings)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }, "Failed to save UVSA network page settings");
  }
}

export const uvsaNetworkSettingsRepository =
  new UVSANetworkSettingsRepository();
