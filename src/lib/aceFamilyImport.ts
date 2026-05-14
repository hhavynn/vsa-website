// JSON-import parser for ACE fams. Accepts the "Sweatpants" handoff shape:
// { family, aliases?, members: [{ name, id_hint?, big, littles[], ... }] }
//
// Handles:
//  - implicit members (names referenced only in `littles` arrays)
//  - duplicate names disambiguated by `id_hint`
//  - role_label derivation: anyone with at least one child → "Big", else "Little"
//
// The resulting ImportPlan has stable UUIDs so the repo can do a two-pass
// insert (rows first with null parents, then update parent_member_id).

export interface SweatpantsMember {
  name: string;
  id_hint?: string;
  big?: string | null;
  littles?: string[];
  siblings?: string[];
  generation?: string | null;
  added_term?: string | null;
  sources?: string[];
  confidence?: string;
  notes?: string;
}

export interface SweatpantsJson {
  family: string;
  aliases?: string[];
  members: SweatpantsMember[];
}

export type RoleLabel = 'Big' | 'Little';

export interface PersonRow {
  id: string;
  name: string;
  role_label: RoleLabel;
  parent_id: string | null;
  display_order: number;
}

export interface ImportPlan {
  familyName: string;
  familySlug: string;
  description: string | null;
  people: PersonRow[];
  warnings: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function explicitKey(m: SweatpantsMember): string {
  return m.id_hint ? `explicit:${m.id_hint}` : `explicit:${m.name}`;
}

function implicitKey(name: string, parentName: string): string {
  return `implicit:${name}|under:${parentName}`;
}

export function validateJson(input: unknown): { ok: true; json: SweatpantsJson } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Root must be an object.' };
  const obj = input as Record<string, unknown>;
  if (typeof obj.family !== 'string' || obj.family.trim().length === 0) {
    return { ok: false, error: '`family` must be a non-empty string.' };
  }
  if (!Array.isArray(obj.members) || obj.members.length === 0) {
    return { ok: false, error: '`members` must be a non-empty array.' };
  }
  for (let i = 0; i < obj.members.length; i++) {
    const m = obj.members[i] as Record<string, unknown>;
    if (typeof m.name !== 'string' || m.name.trim().length === 0) {
      return { ok: false, error: `members[${i}].name is missing or empty.` };
    }
  }
  return { ok: true, json: input as SweatpantsJson };
}

export function buildImportPlan(json: SweatpantsJson): ImportPlan {
  const warnings: string[] = [];

  // Index explicit members by display name.
  const explicitsByName = new Map<string, SweatpantsMember[]>();
  json.members.forEach((m) => {
    const list = explicitsByName.get(m.name) ?? [];
    list.push(m);
    explicitsByName.set(m.name, list);
  });

  // Sanity: duplicate explicit names must use id_hint.
  explicitsByName.forEach((list, name) => {
    if (list.length > 1) {
      const missing = list.filter((m) => !m.id_hint).length;
      if (missing > 0) {
        warnings.push(
          `Duplicate name "${name}" with ${missing} entries missing id_hint. Disambiguation may be wrong.`,
        );
      }
    }
  });

  // For a `littles` listing under `parentName`, find the matching explicit
  // entry (one whose `big === parentName`); otherwise this is an implicit.
  function findExplicitChildOf(littleName: string, parentName: string): SweatpantsMember | null {
    const candidates = explicitsByName.get(littleName) ?? [];
    for (const c of candidates) {
      if (c.big === parentName) return c;
    }
    return null;
  }

  // Map from internal-key → { name, parentKey }
  type Node = { key: string; name: string; parentKey: string | null };
  const nodes = new Map<string, Node>();
  const idByKey = new Map<string, string>();

  function ensureNode(key: string, name: string): Node {
    let n = nodes.get(key);
    if (!n) {
      n = { key, name, parentKey: null };
      nodes.set(key, n);
      idByKey.set(key, crypto.randomUUID());
    }
    return n;
  }

  // Step 1: register every explicit entry.
  json.members.forEach((m) => ensureNode(explicitKey(m), m.name));

  // Step 2: register implicit littles (names in any `littles` array with no
  // matching explicit entry under the same parent).
  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return; // already explicit
      ensureNode(implicitKey(littleName, parent.name), littleName);
    });
  });

  // Step 3: resolve parentKey for every node.
  // Explicit entries: parent = the explicit entry with name === m.big.
  json.members.forEach((m) => {
    const self = nodes.get(explicitKey(m));
    if (!self) return;
    if (!m.big) {
      self.parentKey = null;
      return;
    }
    const parentCandidates = explicitsByName.get(m.big) ?? [];
    if (parentCandidates.length === 0) {
      warnings.push(
        `"${m.name}" lists big "${m.big}" but no explicit entry exists for that name. Treating as root.`,
      );
      self.parentKey = null;
      return;
    }
    if (parentCandidates.length > 1) {
      warnings.push(
        `"${m.name}" lists big "${m.big}" which is ambiguous (${parentCandidates.length} explicit entries). Using the first match.`,
      );
    }
    self.parentKey = explicitKey(parentCandidates[0]);
  });

  // Implicit littles: parent = the explicit member that listed them.
  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return; // already explicit
      const k = implicitKey(littleName, parent.name);
      const n = nodes.get(k);
      if (n) n.parentKey = explicitKey(parent);
    });
  });

  // Step 4: who has at least one child?
  const hasChild = new Set<string>();
  nodes.forEach((n) => {
    if (n.parentKey) hasChild.add(n.parentKey);
  });

  // Step 5: topo-sort (parents before children) so the DB insert order is FK-safe.
  const visited = new Set<string>();
  const ordered: Node[] = [];
  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const n = nodes.get(key);
    if (!n) return;
    if (n.parentKey) visit(n.parentKey);
    ordered.push(n);
  }
  nodes.forEach((n) => visit(n.key));

  // Step 6: emit PersonRow[].
  const people: PersonRow[] = ordered.map((n, i) => ({
    id: idByKey.get(n.key)!,
    name: n.name,
    role_label: hasChild.has(n.key) ? 'Big' : 'Little',
    parent_id: n.parentKey ? idByKey.get(n.parentKey)! : null,
    display_order: i,
  }));

  const description = json.aliases && json.aliases.length > 0
    ? `Also known as: ${json.aliases.join(', ')}.`
    : null;

  return {
    familyName: json.family.trim(),
    familySlug: slugify(json.family),
    description,
    people,
    warnings,
  };
}
