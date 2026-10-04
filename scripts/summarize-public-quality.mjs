#!/usr/bin/env node
/**
 * Summarise the JSON written by scripts/measure-public-quality.mjs as markdown
 * (Lighthouse medians, axe counts by impact, touch-target counts, stuck-hidden
 * counts, lab web-vitals).
 *
 *   node scripts/summarize-public-quality.mjs <out-dir> [<other-out-dir>]
 *
 * With two directories it prints a before/after comparison of the medians.
 */
import fs from 'node:fs';
import path from 'node:path';

const median = (values) => {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const load = (dir, name) => {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};
const fmt = (n, d = 0) => (n === null || n === undefined ? '–' : Number(n).toFixed(d));

function lighthouseRows(dir) {
  const data = load(dir, 'lighthouse.json');
  if (!data) return null;
  const rows = {};
  for (const [route, runs] of Object.entries(data)) {
    const m = (key) => median(runs.map((r) => r[key]));
    rows[route] = {
      n: runs.length,
      performance: m('performance'),
      accessibility: m('accessibility'),
      bestPractices: m('bestPractices'),
      seo: m('seo'),
      fcp: m('fcp'),
      lcp: m('lcp'),
      cls: m('cls'),
      tbt: m('tbt'),
      perfRange: `${Math.min(...runs.map((r) => r.performance))}–${Math.max(...runs.map((r) => r.performance))}`,
      failedA11y: [...new Set(runs.flatMap((r) => r.failedA11y))],
      failedBP: [...new Set(runs.flatMap((r) => r.failedBestPractices))],
    };
  }
  return rows;
}

function probeRows(dir) {
  const data = load(dir, 'probe.json');
  if (!data) return null;
  const rows = {};
  for (const [route, modes] of Object.entries(data)) {
    const count = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const axeIds = new Set();
    for (const key of ['light/no-preference', 'dark/no-preference']) {
      for (const v of modes[key]?.axe ?? []) {
        count[v.impact] += v.nodes;
        axeIds.add(`${v.impact}:${v.id}(${key.split('/')[0]})`);
      }
    }
    const small = (key) => modes[key]?.touchTargets?.small ?? [];
    const nonInline = small('light/no-preference').filter((s) => !s.inlineText);
    rows[route] = {
      axe: count,
      axeIds: [...axeIds],
      touchTotal: modes['light/no-preference']?.touchTargets?.total ?? 0,
      touchExpanded: modes['light/no-preference']?.touchTargets?.expanded ?? 0,
      touchSmall: nonInline.length,
      touchUnder24: nonInline.filter((s) => s.under24).length,
      stuckNormal: (modes['light/no-preference']?.stuckHidden ?? []).length,
      stuckReduced: (modes['light/reduce']?.stuckHidden ?? []).length,
      restNormal: (modes['light/no-preference']?.hiddenBeforeScroll ?? []).length,
      restReduced: (modes['light/reduce']?.hiddenBeforeScroll ?? []).length,
      restReducedDark: (modes['dark/reduce']?.hiddenBeforeScroll ?? []).length,
      vitals: modes['light/no-preference']?.vitals ?? {},
    };
  }
  return rows;
}

const [dirA, dirB] = process.argv.slice(2);
if (!dirA) {
  console.error('usage: summarize-public-quality.mjs <out-dir> [<other-out-dir>]');
  process.exit(1);
}

const env = load(dirA, 'environment.json');
if (env) {
  console.log(`Environment: node ${env.node}, ${env.platform}, runs/route ${env.runs}, ${env.date}`);
  console.log(`Browser: ${env.chrome}\n`);
}

const lhA = lighthouseRows(dirA);
const lhB = dirB ? lighthouseRows(dirB) : null;
if (lhA) {
  console.log('### Lighthouse mobile (median of runs)\n');
  console.log(
    dirB
      ? '| Route | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |\n|---|---|---|---|---|---|---|---|'
      : '| Route | Runs | Perf (range) | A11y | BP | SEO | FCP ms | LCP ms | CLS | TBT ms |\n|---|---|---|---|---|---|---|---|---|---|'
  );
  for (const route of Object.keys(lhA)) {
    const a = lhA[route];
    const b = lhB?.[route];
    if (dirB && b) {
      const pair = (k, d = 0) => `${fmt(a[k], d)} → ${fmt(b[k], d)}`;
      console.log(
        `| \`${route}\` | ${pair('performance')} | ${pair('accessibility')} | ${pair('bestPractices')} | ${pair('seo')} | ${pair('lcp')} | ${pair('cls', 3)} | ${pair('tbt')} |`
      );
    } else {
      console.log(
        `| \`${route}\` | ${a.n} | ${fmt(a.performance)} (${a.perfRange}) | ${fmt(a.accessibility)} | ${fmt(a.bestPractices)} | ${fmt(a.seo)} | ${fmt(a.fcp)} | ${fmt(a.lcp)} | ${fmt(a.cls, 3)} | ${fmt(a.tbt)} |`
      );
    }
  }
  console.log('\nFailed Lighthouse a11y audits (any run)' + (lhB ? ', before → after:' : ':'));
  for (const [route, a] of Object.entries(lhA)) {
    const after = lhB?.[route];
    console.log(`- \`${route}\`: ${a.failedA11y.join(', ') || 'none'}${after ? ` → ${after.failedA11y.join(', ') || 'none'}` : ''}`);
  }
  console.log('\nFailed Lighthouse best-practice audits (any run)' + (lhB ? ', before → after:' : ':'));
  for (const [route, a] of Object.entries(lhA)) {
    const after = lhB?.[route];
    console.log(`- \`${route}\`: ${a.failedBP.join(', ') || 'none'}${after ? ` → ${after.failedBP.join(', ') || 'none'}` : ''}`);
  }
  console.log();
}

const prA = probeRows(dirA);
const prB = dirB ? probeRows(dirB) : null;
if (prA) {
  console.log('### axe-core 4.10.3 (390px viewport, light + dark, nodes by impact C/S/M/m)\n');
  console.log('| Route | axe C/S/M/m | Controls < 44px (non-inline) | < 24px | Hidden at rest, before scroll (normal / reduced) | Still hidden after full scroll (normal / reduced) | INP ms (lab, scripted taps) |');
  console.log('|---|---|---|---|---|---|---|');
  const cell = (r) => `${r.axe.critical}/${r.axe.serious}/${r.axe.moderate}/${r.axe.minor}`;
  for (const route of Object.keys(prA)) {
    const a = prA[route];
    const b = prB?.[route];
    const pair = (fa, fb) => (b ? `${fa(a)} → ${fb(b)}` : fa(a));
    const v = a.vitals;
    console.log(
      `| \`${route}\` | ${pair(cell, cell)} | ${pair((r) => `${r.touchSmall}/${r.touchTotal}`, (r) => `${r.touchSmall}/${r.touchTotal}`)} | ${pair((r) => r.touchUnder24, (r) => r.touchUnder24)} | ${pair((r) => `${r.restNormal} / ${r.restReduced}`, (r) => `${r.restNormal} / ${r.restReduced}`)} | ${pair((r) => `${r.stuckNormal} / ${r.stuckReduced}`, (r) => `${r.stuckNormal} / ${r.stuckReduced}`)} | ${b ? `${fmt(v.INP)} → ${fmt(b.vitals.INP)}` : fmt(v.INP)} |`
    );
  }
  console.log(prB ? '\naxe rules hit (before → after):' : '\naxe rules hit:');
  for (const [route, a] of Object.entries(prA)) {
    const after = prB?.[route];
    const names = (r) => [...new Set(r.axeIds.map((id) => id.replace(/\((light|dark)\)$/, '')))].join(', ') || 'none';
    console.log(`- \`${route}\`: ${names(a)}${after ? ` → ${names(after)}` : ''}`);
  }
}

const stA = load(dirA, 'states.json');
const stB = dirB ? load(dirB, 'states.json') : null;
if (stA) {
  console.log('\n### Interaction states (390px, light) — unique controls under a 44x44 hit area\n');
  console.log('| State | Controls measured | Under 44px | Left over |');
  console.log('|---|---|---|---|');
  const smallOf = (s) => (s?.small ?? []).filter((c) => !c.inlineText);
  for (const [name, a] of Object.entries(stA)) {
    const b = stB?.[name];
    const left = smallOf(b ?? a)
      .slice(0, 3)
      .map((c) => `${c.name || c.tag} (${c.w}x${c.h})`)
      .join('; ');
    console.log(
      `| ${name} | ${a.total}${b ? ` → ${b.total}` : ''} | ${smallOf(a).length}${b ? ` → ${smallOf(b).length}` : ''} | ${b ? left || '–' : '–'} |`
    );
  }
}
