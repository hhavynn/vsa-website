// Smoke test for src/lib/aceFamilyImport.ts using the user's full Sweatpants JSON.
// Mirrors the parser exactly so we can sanity-check numbers without spinning up
// the full app or hitting Supabase. Run with: node scripts/verify-ace-import.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
function explicitKey(m) {
  return m.id_hint ? `explicit:${m.id_hint}` : `explicit:${m.name}`;
}
function implicitKey(name, parentName) {
  return `implicit:${name}|under:${parentName}`;
}

function buildImportPlan(json) {
  const warnings = [];
  const explicitsByName = new Map();
  json.members.forEach((m) => {
    const list = explicitsByName.get(m.name) ?? [];
    list.push(m);
    explicitsByName.set(m.name, list);
  });

  explicitsByName.forEach((list, name) => {
    if (list.length > 1) {
      const missing = list.filter((m) => !m.id_hint).length;
      if (missing > 0) warnings.push(`Duplicate "${name}" missing id_hint x${missing}`);
    }
  });

  function findExplicitChildOf(littleName, parentName) {
    const candidates = explicitsByName.get(littleName) ?? [];
    for (const c of candidates) if (c.big === parentName) return c;
    return null;
  }

  const nodes = new Map();
  const idByKey = new Map();
  function ensureNode(key, name) {
    let n = nodes.get(key);
    if (!n) {
      n = { key, name, parentKey: null };
      nodes.set(key, n);
      idByKey.set(key, randomUUID());
    }
    return n;
  }

  json.members.forEach((m) => ensureNode(explicitKey(m), m.name));

  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return;
      ensureNode(implicitKey(littleName, parent.name), littleName);
    });
  });

  json.members.forEach((m) => {
    const self = nodes.get(explicitKey(m));
    if (!self) return;
    if (!m.big) { self.parentKey = null; return; }
    const parentCandidates = explicitsByName.get(m.big) ?? [];
    if (parentCandidates.length === 0) {
      warnings.push(`"${m.name}" lists big "${m.big}" not found — treating as root`);
      self.parentKey = null;
      return;
    }
    if (parentCandidates.length > 1) warnings.push(`"${m.name}" big "${m.big}" ambiguous`);
    self.parentKey = explicitKey(parentCandidates[0]);
  });

  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return;
      const k = implicitKey(littleName, parent.name);
      const n = nodes.get(k);
      if (n) n.parentKey = explicitKey(parent);
    });
  });

  const hasChild = new Set();
  nodes.forEach((n) => { if (n.parentKey) hasChild.add(n.parentKey); });

  const visited = new Set();
  const ordered = [];
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const n = nodes.get(key);
    if (!n) return;
    if (n.parentKey) visit(n.parentKey);
    ordered.push(n);
  }
  nodes.forEach((n) => visit(n.key));

  const people = ordered.map((n, i) => ({
    id: idByKey.get(n.key),
    name: n.name,
    role_label: hasChild.has(n.key) ? 'Big' : 'Little',
    parent_id: n.parentKey ? idByKey.get(n.parentKey) : null,
    display_order: i,
  }));

  return {
    familyName: json.family.trim(),
    familySlug: slugify(json.family),
    description: json.aliases?.length ? `Also known as: ${json.aliases.join(', ')}.` : null,
    people,
    warnings,
  };
}

const json = JSON.parse(readFileSync(process.argv[2] || '/tmp/sweatpants-test.json', 'utf8'));
const plan = buildImportPlan(json);

const roots = plan.people.filter((p) => p.parent_id === null);
const bigs = plan.people.filter((p) => p.role_label === 'Big');
const littles = plan.people.filter((p) => p.role_label === 'Little');

// FK sanity: every parent_id refers to a person that comes earlier in the array
const seen = new Set();
let outOfOrder = 0;
plan.people.forEach((p) => {
  seen.add(p.id);
  if (p.parent_id && !seen.has(p.parent_id)) outOfOrder++;
});

// Generation depth
const byId = new Map(plan.people.map((p) => [p.id, p]));
function depth(id, guard = new Set()) {
  if (guard.has(id)) return 0;
  guard.add(id);
  const p = byId.get(id);
  if (!p || !p.parent_id) return 1;
  return 1 + depth(p.parent_id, guard);
}
const maxDepth = Math.max(...plan.people.map((p) => depth(p.id)));

console.log('Fam:        ', plan.familyName, '→ slug', plan.familySlug);
console.log('Description:', plan.description);
console.log('Total:      ', plan.people.length);
console.log('  Bigs:     ', bigs.length);
console.log('  Littles:  ', littles.length);
console.log('  Roots:    ', roots.length, '→', roots.map((r) => r.name).join(', '));
console.log('Max depth:  ', maxDepth, 'generations');
console.log('FK order:   ', outOfOrder === 0 ? 'OK (topo-sorted)' : `FAIL (${outOfOrder} out of order)`);
console.log('Warnings:   ', plan.warnings.length ? plan.warnings : '(none)');

// Spot-check the Amy Tran disambiguation
const amys = plan.people.filter((p) => p.name === 'Amy Tran');
console.log('Amy Trans:  ', amys.length, 'rows →', amys.map((a) => {
  const parent = a.parent_id ? byId.get(a.parent_id)?.name : '(root)';
  return `${a.name} under ${parent}`;
}).join('  |  '));
