import { AceFamilyMember } from "../types";
import { MemberAvatarMap, NO_MEMBER_AVATARS, resolveMemberPhoto } from "./memberPhotos";

// The current ACE fam lineup. Each slot shows on the ACE page even before an
// admin creates the fam in Supabase (it renders as a "coming soon" placeholder).
// Icons are served from public/images/ace/fams/; a slot with iconUrl null falls
// back to the generated pattern cover.

export interface ActiveFamSlot {
  name: string;
  slug: string;
  iconUrl: string | null;
  heads: string[];
}

const ICON_DIR = "/images/ace/fams";

export const ACTIVE_FAM_SLOTS: ActiveFamSlot[] = [
  {
    name: "Sweatpants",
    slug: "sweatpants",
    iconUrl: `${ICON_DIR}/sweatpants.webp`,
    heads: ["Jenny Diep"],
  },
  {
    name: "Sunshine",
    slug: "sunshine",
    iconUrl: `${ICON_DIR}/sunshine.webp`,
    heads: ["Colin Tran", "Angelina Nguyen"],
  },
  {
    name: "Underwater",
    slug: "underwater",
    iconUrl: `${ICON_DIR}/underwater.webp`,
    heads: ["Kirsten Ngo", "Tristan Vu"],
  },
  {
    name: "Down",
    slug: "down",
    iconUrl: `${ICON_DIR}/down.svg`,
    heads: ["Ingyin Moh", "Josh Nguyen"],
  },
  {
    name: "Moon",
    slug: "moon",
    iconUrl: `${ICON_DIR}/moon.webp`,
    heads: ["Andy Tran", "An Nguyen"],
  },
  {
    name: "Cross",
    slug: "cross",
    iconUrl: `${ICON_DIR}/cross.webp`,
    heads: ["Anh Thu Vo", "Simon Li"],
  },
  {
    name: "Bang Mi",
    slug: "bang-mi",
    iconUrl: `${ICON_DIR}/bang-mi.webp`,
    heads: ["Deric Chau", "Katherine Chen"],
  },
  {
    name: "NSF",
    slug: "nsf",
    iconUrl: `${ICON_DIR}/nsf.webp`,
    heads: ["Jonas Truong", "Alyssa Nott"],
  },
];

export function getFamSlot(slug: string): ActiveFamSlot | undefined {
  const key = slug.trim().toLowerCase();
  return ACTIVE_FAM_SLOTS.find((slot) => slot.slug === key);
}

export function getFamIconUrl(slug: string): string | null {
  return getFamSlot(slug)?.iconUrl ?? null;
}

// Members whose role_label contains these strings are treated as fam heads.
const FAM_HEAD_KEYWORDS = ["fam head", "family head", "head"];

export function isFamHead(roleLabel: string | null): boolean {
  if (!roleLabel) return false;
  const lower = roleLabel.toLowerCase();
  return FAM_HEAD_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface FamHead {
  name: string;
  photoUrl: string | null;
  roleLabel: string | null;
}

const normalizeName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const memberPhoto = (member: AceFamilyMember | undefined, avatars: MemberAvatarMap) =>
  member ? resolveMemberPhoto(avatars, member.member_id, member.photo_url) : null;

/**
 * Fam heads for a fam: members an admin labelled as heads win; otherwise the
 * roster's named heads, borrowing a photo from a same-named tree member. A
 * tree member linked to members.id shows their shared approved avatar.
 */
export function resolveFamHeads(
  slug: string,
  members: AceFamilyMember[],
  avatars: MemberAvatarMap = NO_MEMBER_AVATARS,
): FamHead[] {
  const labelled = members.filter((m) => isFamHead(m.role_label));
  if (labelled.length > 0) {
    return labelled.map((m) => ({
      name: m.name,
      photoUrl: memberPhoto(m, avatars),
      roleLabel: m.role_label,
    }));
  }

  const byName = new Map(members.map((m) => [normalizeName(m.name), m]));
  return (getFamSlot(slug)?.heads ?? []).map((name) => ({
    name,
    photoUrl: memberPhoto(byName.get(normalizeName(name)), avatars),
    roleLabel: "Fam Head",
  }));
}
