import fs from 'fs';
import path from 'path';
import {
  checkInlineScripts,
  extractDocScriptSrcHashes,
  findInlineScripts,
  hashInlineScript,
  sameHashSet,
} from '../../scripts/lib/cspInlineHashes.mjs';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const allowlist: string[] = JSON.parse(read('config/csp-script-hashes.json')).hashes.map(
  (entry: { hash: string }) => entry.hash
);

// `printf 'alert(1)' | openssl dgst -sha256 -binary | base64`
const ALERT_1_HASH = 'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=';

describe('hashInlineScript', () => {
  it('matches a known sha256 in CSP source form', () => {
    expect(hashInlineScript('alert(1)')).toBe(ALERT_1_HASH);
  });

  it('hashes the exact text: whitespace and non-ASCII bytes count', () => {
    expect(hashInlineScript('alert(1) ')).not.toBe(ALERT_1_HASH);
    expect(hashInlineScript('\nalert(1)')).not.toBe(ALERT_1_HASH);
    // "é" is two UTF-8 bytes; the browser hashes UTF-8.
    expect(hashInlineScript('é')).toBe('sha256-SplVfkAzw1Od4utlRyAXytX5VX96BiWgnxw/biumnEw=');
  });
});

describe('findInlineScripts', () => {
  it('returns inline scripts with their exact text and ignores src, comment and data scripts', () => {
    const html = `
      <!-- <script>commented()</script> -->
      <script src="/static/js/main.js"></script>
      <script defer="defer" src='/x.js'></script>
      <script type="application/ld+json">{"a":1}</script>
      <script>alert(1)</script>
      <script type="module">import('/x.js')</script>
    `;
    expect(findInlineScripts(html).map(script => script.text)).toEqual(['alert(1)', "import('/x.js')"]);
    expect(findInlineScripts(html)[0].hash).toBe(ALERT_1_HASH);
  });

  it('includes import maps and speculation rules, which CSP script-src also governs', () => {
    const html = `
      <script type="importmap">{"imports":{}}</script>
      <script type="speculationrules">{"prerender":[]}</script>
      <script type="application/json">{"data":1}</script>
    `;
    expect(findInlineScripts(html).map(script => script.text)).toEqual(['{"imports":{}}', '{"prerender":[]}']);
  });

  it('matches end tags with trailing whitespace or junk, as HTML does', () => {
    expect(findInlineScripts('<script>alert(1)</script\t\n bar>').map(script => script.text)).toEqual(['alert(1)']);
  });

  it('does not let stripping one comment splice a script back together', () => {
    expect(findInlineScripts('<!<!-- x -->-- <script>hidden()</script> -->')).toEqual([]);
  });

  it('finds nothing in a page with only external scripts', () => {
    expect(findInlineScripts('<script defer src="/a.js"></script>')).toEqual([]);
  });
});

describe('checkInlineScripts', () => {
  it('passes when every inline script is allowlisted and every allowlisted hash is present', () => {
    const result = checkInlineScripts('<script>alert(1)</script>', [ALERT_1_HASH]);
    expect(result.unexpected).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('flags an inline script that is not allowlisted, with its actual hash', () => {
    const result = checkInlineScripts('<script>alert(1)</script><script>evil()</script>', [ALERT_1_HASH]);
    expect(result.unexpected).toHaveLength(1);
    expect(result.unexpected[0].hash).toBe(hashInlineScript('evil()'));
  });

  it('flags a one-character change to an allowlisted script', () => {
    const result = checkInlineScripts('<script>alert(2)</script>', [ALERT_1_HASH]);
    expect(result.unexpected).toHaveLength(1);
    expect(result.stale).toEqual([ALERT_1_HASH]);
  });

  it('flags a stale allowlist entry', () => {
    expect(checkInlineScripts('<p>no scripts</p>', [ALERT_1_HASH]).stale).toEqual([ALERT_1_HASH]);
  });
});

describe('CSP draft and build configuration', () => {
  it('names the same hashes in the doc draft script-src as the allowlist', () => {
    const docHashes = extractDocScriptSrcHashes(read('docs/security-headers-and-csp.md'));
    expect(docHashes).not.toBeNull();
    expect(sameHashSet(docHashes as string[], allowlist)).toBe(true);
  });

  it('no longer lists unsafe-inline in the draft script-src', () => {
    const line = read('docs/security-headers-and-csp.md')
      .split('\n')
      .find(candidate => /^\s*script-src\b/.test(candidate));
    expect(line).toBeDefined();
    expect(line).not.toContain("'unsafe-inline'");
  });

  it('ships no CSP header yet (report-only rollout is #223, enforcement #224)', () => {
    const keys = JSON.stringify(JSON.parse(read('vercel.json')).headers).toLowerCase();
    expect(keys).not.toContain('content-security-policy');
  });
});
