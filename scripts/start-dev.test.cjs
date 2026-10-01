'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { test } = require('node:test');
const http = require('node:http');

function rawStatus(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
}

test('patched CRA dev server serves routes and source behind host/origin guards and stops cleanly', { timeout: 120000 }, async () => {
  const child = spawn(process.execPath, ['scripts/start-dev.cjs'], {
    env: { ...process.env, BROWSER: 'none', HOST: '127.0.0.1', PORT: '3015' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  try {
    const deadline = Date.now() + 100000;
    while (!output.includes('Compiled successfully!')) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const base = 'http://127.0.0.1:3015';
    const route = await fetch(base + '/calendar');
    assert.equal(route.status, 200);
    assert.match(await route.text(), /<div id="root"><\/div>/);
    assert.equal(route.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
    assert.equal(route.headers.get('Access-Control-Allow-Origin'), null);

    const sourcePath = '/__get-internal-source?fileName=' + encodeURIComponent('webpack-internal:///./src/App.tsx');
    assert.equal(await rawStatus(base + sourcePath, { Host: 'attacker.invalid' }), 403);
    assert.equal(await rawStatus(base + sourcePath, { 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' }), 403);
    const invalidSource = await fetch(base + '/__get-internal-source');
    assert.equal(invalidSource.status, 400);
    const absentSource = await fetch(base + '/__get-internal-source?fileName=webpack-internal:///missing');
    assert.equal(absentSource.status, 404);
    const source = await fetch(base + sourcePath);
    assert.equal(source.status, 200);
    assert.match(await source.text(), /function App|const App/);
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    const [code, signal] = await exited;
    clearTimeout(timer);
    assert.equal(signal, null, output);
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /TypeError|ValidationError|Failed to compile/);
  }
});
