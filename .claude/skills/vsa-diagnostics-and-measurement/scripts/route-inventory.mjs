#!/usr/bin/env node
// route-inventory.mjs — list every route registered in src/routes/index.tsx.
// Pure regex parse, zero dependencies. Classifies each route as public /
// protected / admin by its text position relative to the <ProtectedRoute> /
// <AdminRoute> wrapper elements (heuristic: re-verify manually if the routes
// file is restructured).
//
// Usage:  node .claude/skills/vsa-diagnostics-and-measurement/scripts/route-inventory.mjs [--json]

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const routesFile = join(repoRoot, 'src', 'routes', 'index.tsx');
const src = readFileSync(routesFile, 'utf8');

// Find spans wrapped by <ProtectedRoute ...> ... </ProtectedRoute> etc.
// Route elements wrapped via element={<ProtectedRoute>...} on a parent <Route>
// are handled by scanning for the wrapper openings and the matching close tag.
function wrapperSpans(tag) {
  const spans = [];
  const openRe = new RegExp(`<${tag}[\\s>]`, 'g');
  let m;
  while ((m = openRe.exec(src)) !== null) {
    const close = src.indexOf(`</${tag}>`, m.index);
    // Self-closing or unmatched: skip (no children to classify).
    if (close !== -1) spans.push([m.index, close]);
  }
  return spans;
}

const protectedSpans = wrapperSpans('ProtectedRoute');
const adminSpans = wrapperSpans('AdminRoute');
const inSpan = (spans, i) => spans.some(([a, b]) => i > a && i < b);

const routes = [];
const routeRe = /path=(?:"([^"]+)"|\{`([^`]+)`\}|\{'([^']+)'\})/g;
let m;
while ((m = routeRe.exec(src)) !== null) {
  const path = m[1] ?? m[2] ?? m[3];
  let tier = 'public';
  if (inSpan(adminSpans, m.index)) tier = 'admin';
  else if (inSpan(protectedSpans, m.index)) tier = 'protected';
  // Fallback heuristic when wrappers are applied per-route via element prop:
  if (tier === 'public' && path.startsWith('/admin') && path !== '/admin/login') tier = 'admin';
  routes.push({ path, tier });
}

if (routes.length === 0) {
  console.error(`ERROR: no path="..." attributes found in ${routesFile} — regex or file layout changed.`);
  process.exit(1);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ source: 'src/routes/index.tsx', count: routes.length, routes }, null, 2));
} else {
  const counts = { public: 0, protected: 0, admin: 0 };
  const pad = Math.max(...routes.map((r) => r.path.length)) + 2;
  for (const r of routes) {
    counts[r.tier]++;
    console.log(r.path.padEnd(pad) + r.tier);
  }
  console.log('---');
  console.log(
    `${routes.length} routes: ${counts.public} public, ${counts.protected} protected, ${counts.admin} admin`
  );
}
