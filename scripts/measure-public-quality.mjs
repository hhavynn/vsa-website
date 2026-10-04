#!/usr/bin/env node
/**
 * Public-route quality measurement harness (issue #297).
 *
 * Serves a production `build/` directory with an SPA fallback (gzip, immutable
 * asset caching — roughly what Vercel does), then measures each route:
 *
 *   lighthouse  mobile Lighthouse (default mobile emulation + simulated 4x
 *               CPU / slow-4G throttling), N runs, scores + LCP/CLS/TBT
 *   states      touch targets with menus / sheets / floating controls open
 *   probe       one Puppeteer pass per route/theme at a 390px viewport:
 *                 - axe-core violations by impact (WCAG A/AA + best-practice)
 *                 - touch-target audit (interactive controls under 44x44 CSS px)
 *                 - reduced-motion audit (visible content stuck at opacity 0)
 *                 - web-vitals LCP / CLS / INP (lab, scripted interaction)
 *
 * Tools are NOT repo dependencies. Install them in a throwaway directory:
 *
 *   mkdir /tmp/vsa-tools && cd /tmp/vsa-tools && npm init -y >/dev/null \
 *     && npm i lighthouse@13.0.1 puppeteer-core axe-core@4.10.3 chrome-launcher web-vitals
 *
 * Usage:
 *   node scripts/measure-public-quality.mjs --tools /tmp/vsa-tools \
 *     --build build --out /tmp/vsa-measure/before [--runs 5] \
 *     [--stages lighthouse,probe] [--routes /,/events] [--port 3010]
 *
 * Browser: set CHROME_PATH (defaults to Microsoft Edge on macOS).
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);

const TOOLS = path.resolve(args.tools || '/tmp/vsa-tools');
const BUILD = path.resolve(args.build || 'build');
const OUT = path.resolve(args.out || '/tmp/vsa-measure/run');
const RUNS = Number(args.runs || 5);
const PORT = Number(args.port || 3010);
const STAGES = String(args.stages || 'lighthouse,probe').split(',');
const ROUTES = String(
  args.routes || '/,/events,/leaderboard,/gallery,/house,/points,/get-involved'
).split(',');
const CHROME =
  process.env.CHROME_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

const req = createRequire(path.join(TOOLS, 'package.json'));
const importTool = (name) => import(pathToFileURL(req.resolve(name)).href);

fs.mkdirSync(OUT, { recursive: true });

// --- static server with SPA fallback ---------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml']);

function startServer() {
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent(request.url.split('?')[0]);
    let file = path.join(BUILD, urlPath);
    if (!file.startsWith(BUILD)) file = BUILD;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = urlPath.startsWith('/static/') ? null : path.join(BUILD, 'index.html');
    }
    if (!file || !fs.existsSync(file)) {
      response.writeHead(404).end('not found');
      return;
    }
    const ext = path.extname(file);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': urlPath.startsWith('/static/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
    };
    let body = fs.readFileSync(file);
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(request.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    response.writeHead(200, headers).end(body);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_'));

// --- lighthouse -------------------------------------------------------------
async function runLighthouse() {
  const { default: lighthouse } = await importTool('lighthouse');
  const chromeLauncher = await importTool('chrome-launcher');
  const results = {};
  for (const route of ROUTES) {
    results[route] = [];
    for (let i = 0; i < RUNS; i++) {
      const chrome = await chromeLauncher.launch({
        chromePath: CHROME,
        chromeFlags: ['--headless=new', '--no-sandbox'],
      });
      try {
        const runner = await lighthouse(
          `http://localhost:${PORT}${route}`,
          { port: chrome.port, output: 'json', logLevel: 'error' },
          undefined
        );
        const lhr = runner.lhr;
        const audit = (id) => lhr.audits[id]?.numericValue ?? null;
        const failedA11y = Object.values(lhr.audits)
          .filter(
            (a) =>
              lhr.categories.accessibility.auditRefs.some((r) => r.id === a.id) &&
              a.score !== null &&
              a.score < 1
          )
          .map((a) => a.id);
        results[route].push({
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100),
          fcp: audit('first-contentful-paint'),
          lcp: audit('largest-contentful-paint'),
          cls: audit('cumulative-layout-shift'),
          tbt: audit('total-blocking-time'),
          si: audit('speed-index'),
          failedA11y,
          failedBestPractices: Object.values(lhr.audits)
            .filter(
              (a) =>
                lhr.categories['best-practices'].auditRefs.some((r) => r.id === a.id) &&
                a.score !== null &&
                a.score < 1
            )
            .map((a) => a.id),
        });
        process.stderr.write(
          `lh ${route} run ${i + 1}/${RUNS}: perf ${results[route].at(-1).performance} a11y ${results[route].at(-1).accessibility}\n`
        );
      } finally {
        await chrome.kill();
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'lighthouse.json'), JSON.stringify(results, null, 2));
}

// --- puppeteer probe --------------------------------------------------------
const INTERACTIVE =
  'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem], [role=option], [role=radio], [tabindex]:not([tabindex="-1"])';

const STUCK_HIDDEN = () => {
            const out = [];
            document.querySelectorAll('body *').forEach((el) => {
              const text = (el.innerText || '').trim();
              if (!text || text.length < 2) return;
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') return;
              // effective opacity through ancestors
              let eff = 1;
              for (let n = el; n && n !== document.body; n = n.parentElement) {
                eff *= parseFloat(getComputedStyle(n).opacity);
              }
              const r = el.getBoundingClientRect();
              if (r.width < 2 || r.height < 2) return;
              // hover/focus-only affordances (e.g. "Preview Album") are intentionally transparent
              if (/(^|\s)(group-hover|hover|focus|group-focus)[^ ]*:opacity|sr-only/.test(String(el.className || '')) ||
                  /opacity-0/.test(String(el.className || '')) && /group-hover:opacity-100/.test(String(el.className || ''))) return;
              if (eff < 0.05) {
                // only report the outermost hidden element
                let p = el.parentElement;
                while (p && p !== document.body) {
                  let peff = 1;
                  for (let n = p; n && n !== document.body; n = n.parentElement)
                    peff *= parseFloat(getComputedStyle(n).opacity);
                  if (peff < 0.05) return;
                  p = p.parentElement;
                }
                out.push({
                  tag: el.tagName.toLowerCase(),
                  cls: String(el.className || '').slice(0, 80),
                  text: text.slice(0, 50),
                });
              }
            });
            return out.slice(0, 40);
          };

const COLLECT_TOUCH_TARGETS = (sel, scopeSel) => {
              const seen = new Set();
              const small = [];
              let total = 0;
              let expanded = 0;
              // With a modal dialog open, only its controls are reachable; a scope can also be forced.
              const scope =
                (scopeSel && document.querySelector(scopeSel)) || document.querySelector('[role="dialog"][aria-modal="true"]');
              document.querySelectorAll(sel).forEach((el) => {
                if (scope && !scope.contains(el)) return;
                const cs = getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') return;
                if (el.closest('[aria-hidden="true"]') && !el.matches(':focus')) return;
                if (el.disabled) return;
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                // sr-only / skip links
                if (r.width <= 1 || r.height <= 1) return;
                // visibility: clip to document horizontally
                if (r.right < 0 || r.left > innerWidth + 1) return;
                // hidden via opacity 0
                let eff = 1;
                for (let n = el; n && n !== document.body; n = n.parentElement) eff *= parseFloat(getComputedStyle(n).opacity);
                if (eff < 0.05) return;
                total++;
                // inline text links inside running prose are exempt (WCAG 2.5.8 inline exception)
                const inline =
                  el.tagName === 'A' &&
                  cs.display === 'inline' &&
                  !!el.closest('p, li, dd, blockquote, span, td') &&
                  (el.parentElement?.textContent || '').trim().length > (el.textContent || '').trim().length + 8;
                const rectSmall = r.width < 43.5 || r.height < 43.5;
                if (!rectSmall) return;
                // The control may own a bigger tappable area than its box (a stretched ::after,
                // the .touch-hit utility). Hit-test a 44x44 box centred on it: if the element
                // itself is topmost at its corners and centre, the usable hit area is >= 44x44.
                el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
                const r2 = el.getBoundingClientRect();
                const vw = document.documentElement.clientWidth;
                const bx = Math.min(Math.max(r2.left + r2.width / 2 - 22, 0), vw - 44);
                const by = Math.min(Math.max(r2.top + r2.height / 2 - 22, 0), innerHeight - 44);
                const probes = [[bx + 2, by + 2], [bx + 42, by + 2], [bx + 2, by + 42], [bx + 42, by + 42], [bx + 22, by + 22]];
                const hitOk = probes.every(([x, y]) => {
                  const top = document.elementsFromPoint(x, y)[0];
                  return !!top && (top === el || el.contains(top));
                });
                if (hitOk && !inline) {
                  expanded++;
                  return;
                }
                const key = el.tagName + '|' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) + '|' + Math.round(r.width) + 'x' + Math.round(r.height);
                if (seen.has(key)) return;
                seen.add(key);
                small.push({
                  tag: el.tagName.toLowerCase(),
                  role: el.getAttribute('role') || '',
                  name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
                  cls: String(el.className || '').slice(0, 70),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  inlineText: inline,
                  under24: r.width < 23.5 || r.height < 23.5,
                });
              });
              window.scrollTo(0, 0);
              return { total, small, expanded };
            };

async function runProbe() {
  const puppeteer = (await importTool('puppeteer-core')).default;
  const axeSource = fs.readFileSync(path.join(TOOLS, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const vitalsSource = fs.readFileSync(path.join(TOOLS, 'node_modules/web-vitals/dist/web-vitals.iife.js'), 'utf8');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
  });
  const results = {};
  try {
    for (const route of ROUTES) {
      results[route] = {};
      for (const theme of ['light', 'dark']) {
        for (const motion of ['no-preference', 'reduce']) {
          // axe + touch targets once per theme (normal motion); motion probe both modes
          const page = await browser.newPage();
          await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
          await page.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: theme },
            { name: 'prefers-reduced-motion', value: motion },
          ]);
          await page.evaluateOnNewDocument((t) => {
            try {
              localStorage.setItem('theme', t);
            } catch {}
          }, theme);
          await page.evaluateOnNewDocument(vitalsSource);
          await page.evaluateOnNewDocument(() => {
            window.__vitals = {};
            document.addEventListener('DOMContentLoaded', () => {
              const v = window.webVitals;
              if (!v) return;
              const rec = (m) => (window.__vitals[m.name] = m.value);
              v.onLCP(rec, { reportAllChanges: true });
              v.onCLS(rec, { reportAllChanges: true });
              v.onINP(rec, { reportAllChanges: true });
            });
          });
          await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));
          // content hidden at rest, before anything scrolls into view
          const hiddenBeforeScroll = await page.evaluate(STUCK_HIDDEN);
          // scroll through the page so whileInView reveals fire
          await page.evaluate(async () => {
            // re-read scrollHeight every step: lazy content grows the page while we scroll
            for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 150));
            }
            window.scrollTo(0, document.documentElement.scrollHeight);
            await new Promise((r) => setTimeout(r, 800));
            window.scrollTo(0, 0);
            await new Promise((r) => setTimeout(r, 1500));
          });

          const entry = { theme, motion, hiddenBeforeScroll };

          // stuck-hidden content audit (after a full scroll-through)
          entry.stuckHidden = await page.evaluate(STUCK_HIDDEN);

          if (motion === 'no-preference') {
            // axe (first-visit state: the analytics banner is showing)
            await page.evaluate(axeSource);
            entry.axe = await page.evaluate(async () => {
              const r = await window.axe.run(document, {
                runOnly: { type: 'tag', // 'experimental' enables rules Lighthouse also runs (e.g. label-content-name-mismatch)
                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice', 'experimental'] },
              });
              return r.violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                nodes: v.nodes.length,
                help: v.help,
                targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
              }));
            });

            // lab INP: tap the first few visible buttons that are safe (menu/theme)
            await page.evaluate(() => window.scrollTo(0, 0));
            const btn = await page.$('button[aria-label*="menu" i], button[aria-label*="navigation" i]');
            if (btn) {
              await btn.tap().catch(() => {});
              await new Promise((r) => setTimeout(r, 600));
              await page.keyboard.press('Escape').catch(() => {});
              await new Promise((r) => setTimeout(r, 400));
              await btn.tap().catch(() => {});
              await new Promise((r) => setTimeout(r, 600));
            }
            // flush INP by hiding the page
            await page.evaluate(() => {
              Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
              document.dispatchEvent(new Event('visibilitychange'));
            });
            entry.vitals = await page.evaluate(() => window.__vitals);

            // touch-target audit, with the analytics choice already made so the fixed
            // first-visit banner does not cover the controls underneath it. The banner's
            // own buttons are measured in the "analytics banner (first visit)" state.
            if (theme === 'light') {
              await page.evaluate(() => {
                try { localStorage.setItem('vsa-analytics-consent-v1', 'declined'); } catch {}
              });
              await page.reload({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
              await new Promise((r) => setTimeout(r, 1500));
              entry.touchTargets = await page.evaluate(COLLECT_TOUCH_TARGETS, INTERACTIVE);
            }
          }

          results[route][`${theme}/${motion}`] = entry;
          process.stderr.write(`probe ${route} ${theme} ${motion}\n`);
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
}


// --- interaction states (menus, sheets, floating controls) ---------------------
const STATES = [
  { name: 'analytics banner (first visit)', route: '/', scope: 'section.fixed.bottom-3', steps: async () => {} },
  { name: 'back-to-top (scrolled)', route: '/', steps: async (page) => { await page.evaluate(() => window.scrollTo(0, 900)); await sleep(800); } },
  { name: 'mobile menu open', route: '/', steps: async (page) => { await clickBy(page, 'button[aria-label="Open navigation menu"]'); await sleep(700); } },
  { name: 'Ask VSA panel open', route: '/', scope: '[role="dialog"]', steps: async (page) => { await clickBy(page, 'button[aria-label="Ask VSA (open assistant)"]'); await sleep(900); } },
  { name: 'calendar day sheet', route: '/calendar', steps: async (page) => { await clickBy(page, 'ol button, [role="button"], button[aria-label^="Open"]'); await sleep(900); } },
  { name: 'leaderboard profile sheet', route: '/leaderboard', steps: async (page) => { await clickBy(page, '[aria-label^="Open profile for"]'); await sleep(900); } },
  { name: 'gallery album preview', route: '/gallery', steps: async (page) => { await clickBy(page, 'a[aria-label$="Preview album"]'); await sleep(900); } },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickBy(page, selector) {
  const handle = await page.$(selector);
  if (!handle) throw new Error(`no element for ${selector}`);
  await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await handle.tap().catch(() => handle.click());
}

async function runStates() {
  const puppeteer = (await importTool('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const results = {};
  try {
    for (const state of STATES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const seedConsent = !state.name.startsWith('analytics banner');
      await page.evaluateOnNewDocument((seed) => {
        try {
          localStorage.setItem('theme', 'light');
          if (seed) localStorage.setItem('vsa-analytics-consent-v1', 'declined');
        } catch {}
      }, seedConsent);
      await page.goto(`http://localhost:${PORT}${state.route}`, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
      await sleep(1200);
      let note = '';
      try {
        await state.steps(page);
      } catch (error) {
        note = String(error.message || error);
      }
      const touchTargets = await page.evaluate(COLLECT_TOUCH_TARGETS, INTERACTIVE, state.scope || null);
      results[state.name] = { route: state.route, note, ...touchTargets };
      process.stderr.write(`state ${state.name}: ${touchTargets.small.filter((s) => !s.inlineText).length}/${touchTargets.total} small ${note}\n`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify(results, null, 2));
}

const server = await startServer();
try {
  fs.writeFileSync(
    path.join(OUT, 'environment.json'),
    JSON.stringify(
      {
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        chrome: CHROME,
        runs: RUNS,
        routes: ROUTES,
        build: BUILD,
        date: new Date().toISOString(),
      },
      null,
      2
    )
  );
  if (STAGES.includes('lighthouse')) await runLighthouse();
  if (STAGES.includes('probe')) await runProbe();
  if (STAGES.includes('states')) await runStates();
} finally {
  server.close();
}
