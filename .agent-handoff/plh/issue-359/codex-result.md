# Codex Result - Issue #359

## Files changed

Implementation files:

- `LICENSE` - new canonical MIT license text.
- `NOTICE.md` - new code-vs-content boundary notice.
- `README.md` - replaced the previous License section.
- `package.json` - added `"license": "MIT"`.
- `.github/CONTRIBUTING.md` - added contributor licensing expectations.

Report file:

- `.agent-handoff/plh/issue-359/codex-result.md` - this handoff report.

No application source, tests, migrations, images, `node_modules/`, Graphify output, or `.claude/settings.local.json` were modified.

## Implementation summary

Added the repository-owner-settled licensing split:

- Original software code authored for this repository is MIT-licensed with copyright holder `Vietnamese Student Association at UC San Diego`.
- Non-code content is explicitly not MIT-licensed, including `public/images/**`, the requested image subdirectories, VSA name/logo/marks, site copy, archives, written content, application content, and member data.
- Third-party assets, fonts, dependencies, and libraries retain their own licenses.
- Trademark rights are not granted by the code license.
- Forking is clarified as permission to use the MIT-licensed code only, not the non-code content.

## Decisions made

- Used the canonical MIT text in `LICENSE` and did not paraphrase it.
- Used the organization, not an individual contributor, as the copyright holder.
- Used conservative ownership language in `NOTICE.md`: when the repository does not make ownership of a photograph or other non-code asset clear, the notice does not claim ownership for the organization or any individual contributor.
- Did not invent an email address. The removal-request path points to `SECURITY.md`; for non-security-sensitive or unavailable private reporting, it also names the repository issue tracker.
- Included current logo paths found in the repo: `public/images/vsa-logo.svg`, `public/images/vsa-logo.png`, `public/images/vsa-logo.jpg`, `public/logo192.png`, and `public/logo512.png`.
- `NOTICE.md` excludes all `public/images/**`, so directories beyond the specifically named `cabinet/`, `events/`, `gallery/`, and `2024events/` are also not offered under MIT.

## Tests added or changed

None. The plan explicitly called for no new tests because this is a policy/docs-only change plus one additive `package.json` metadata field.

## Assumptions

- The licensing decision in `.agent-handoff/plh/issue-359/implementation-plan.md` is authoritative and settled by the repository owner.
- The current repository source is authoritative for published contact paths and asset paths.
- Because `SECURITY.md` publishes no email address, the report/removal language should not create one.
- The worktree being behind `origin/main` by one commit was not changed because the user explicitly instructed no Git/GitHub operations.

## Limitations

- Whether existing consent covers publishing member photographs in a public, forkable git repository is a separate unresolved question that this PR does not settle.
- This change documents the licensing boundary. It does not remove, move, audit, or relicense any image or third-party asset.
- I did not inspect ownership/licensing provenance for every individual non-code asset. The notice uses conservative language and excludes non-code content from MIT unless a specific file says otherwise.
- The Graphify wrapper version check was attempted but did not produce a version because the wrapper hit CRLF/shebang handling under WSL/Git Bash, and the underlying `graphify --version` command is not supported. `graphify-out/graph.json` exists, and no Graphify query, install, update, or graph-output edit was performed.

## Blockers

None for the requested implementation. Build and tests pass using the Windows Node 22 toolchain; the literal POSIX-style `CI=true ...` test command was run successfully through Git Bash because PowerShell does not parse POSIX environment-variable prefixes.

## Commands run and verbatim results

### Graphify check

Command:

```powershell
bash -lc './scripts/graphify-run --version || true'
```

Output:

```text
/usr/bin/env: ‘bash\r’: Permission denied
```

Command:

```powershell
bash -lc 'bash ./scripts/graphify-run --version || true'
```

Output:

```text
./scripts/graphify-run: line 10: set: pipefail: invalid option name
```

Command:

```powershell
Test-Path graphify-out\graph.json
```

Output:

```text
True
```

Command:

```powershell
graphify --version
```

Output:

```text
error: unknown command '--version'
Run 'graphify --help' for usage.
```

### Dependency install

Command:

```powershell
npm ci
```

Output:

```text

added 1438 packages, and audited 1439 packages in 1m

284 packages are looking for funding
  run `npm fund` for details

60 vulnerabilities (14 low, 13 moderate, 30 high, 3 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated @babel/plugin-proposal-nullish-coalescing-operator@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-nullish-coalescing instead.
npm warn deprecated @babel/plugin-proposal-private-methods@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-private-methods instead.
npm warn deprecated @babel/plugin-proposal-numeric-separator@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-numeric-separator instead.
npm warn deprecated @babel/plugin-proposal-class-properties@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-class-properties instead.
npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm warn deprecated stable@0.1.8: Modern JS already guarantees Array#sort() is a stable sort, so this library is deprecated. See the compatibility table on MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#browser_compatibility
npm warn deprecated rimraf@2.6.3: Rimraf versions prior to v4 are no longer supported
npm warn deprecated @babel/plugin-proposal-private-property-in-object@7.21.11: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-private-property-in-object instead.
npm warn deprecated @babel/plugin-proposal-optional-chaining@7.21.0: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-optional-chaining instead.
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm warn deprecated rollup-plugin-terser@7.0.2: This package has been deprecated and is no longer maintained. Please use @rollup/plugin-terser
npm warn deprecated abab@2.0.6: Use your platform's native atob() and btoa() methods instead
npm warn deprecated q@1.5.1: You or someone you depend on is using Q, the JavaScript Promise library that gave JavaScript developers strong feelings about promises. They can almost certainly migrate to the native JavaScript promise now. Thank you literally everyone for joining me in this bet against the odds. Be excellent to each other.
npm warn deprecated
npm warn deprecated (For a CapTP with native promises, see @endo/eventual-send and @endo/captp)
npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm warn deprecated domexception@2.0.6: Use your platform's native DOMException instead
npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead
npm warn deprecated w3c-hr-time@1.0.2: Use your platform's native performance.now() and performance.timeOrigin.
npm warn deprecated workbox-cacheable-response@6.6.0: workbox-background-sync@6.6.0
npm warn deprecated workbox-google-analytics@6.6.0: It is not compatible with newer versions of GA starting with v4, as long as you are using GAv3 it should be ok, but the package is not longer being maintained
npm warn deprecated svgo@1.3.2: This SVGO version is no longer supported. Upgrade to v2.x.x.
npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
```

### Static diff check

Command:

```powershell
git diff --check
```

Output:

```text
warning: in the working copy of '.github/CONTRIBUTING.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
```

### Required verification

Command:

```powershell
git --no-pager diff --stat
```

Output:

```text
 .github/CONTRIBUTING.md | 7 +++++++
 README.md               | 5 ++++-
 package.json            | 1 +
 3 files changed, 12 insertions(+), 1 deletion(-)
warning: in the working copy of '.github/CONTRIBUTING.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
```

Note: `git diff --stat` does not include untracked new files. `LICENSE` and `NOTICE.md` appear in the `git status --short` output below.

Command:

```powershell
git status --short
```

Output:

```text
 M .github/CONTRIBUTING.md
 M README.md
 M package.json
?? .agent-handoff/
?? LICENSE
?? NOTICE.md
```

Command:

```powershell
node -p "require('./package.json').license"
```

Output:

```text
MIT
```

Command:

```powershell
npm run build
```

Output:

```text

> vsa-website@0.1.0 build
> node ./node_modules/react-scripts/bin/react-scripts.js build

Creating an optimized production build...
Compiled successfully.

File sizes after gzip:

  192.25 kB  build\static\js\main.6eaa79c5.js
  25.6 kB    build\static\css\main.852aec43.css
  21.95 kB   build\static\js\9624.cca78ed5.chunk.js
  20.3 kB    build\static\js\9833.60368605.chunk.js
  17.24 kB   build\static\js\4818.25b7964b.chunk.js
  16.88 kB   build\static\js\1341.622a6cde.chunk.js
  16.48 kB   build\static\js\8789.b52edd4c.chunk.js
  15.48 kB   build\static\js\5053.1ae5b251.chunk.js
  15.13 kB   build\static\js\7158.c1d0a0a6.chunk.js
  14.36 kB   build\static\js\5139.43e76d6e.chunk.js
  14.06 kB   build\static\js\6452.bd4398e9.chunk.js
  13.91 kB   build\static\js\6242.a1060954.chunk.js
  13.48 kB   build\static\js\6407.2ccd5645.chunk.js
  12.71 kB   build\static\js\9756.8959f4e9.chunk.js
  12.53 kB   build\static\js\880.e0fecb25.chunk.js
  11.53 kB   build\static\js\1850.4024f1ad.chunk.js
  11.4 kB    build\static\js\5943.c3353046.chunk.js
  11.05 kB   build\static\js\4558.027e378b.chunk.js
  9.84 kB    build\static\js\5025.41e30a45.chunk.js
  9.67 kB    build\static\js\5395.6cbec14f.chunk.js
  9.61 kB    build\static\js\9902.29529334.chunk.js
  9.47 kB    build\static\js\2096.ed0d68fc.chunk.js
  8.8 kB     build\static\js\4209.364a643d.chunk.js
  8.23 kB    build\static\js\4011.9432995d.chunk.js
  7.81 kB    build\static\js\3893.0fbddc75.chunk.js
  7.76 kB    build\static\js\9949.e2fac8fc.chunk.js
  7.36 kB    build\static\js\8412.3c91a5b7.chunk.js
  7.05 kB    build\static\js\9216.6e8e6d94.chunk.js
  6.4 kB     build\static\js\5939.62b548fd.chunk.js
  6.38 kB    build\static\js\4584.72e6a95d.chunk.js
  5.94 kB    build\static\js\3571.cba1e724.chunk.js
  5.92 kB    build\static\js\906.05c1713e.chunk.js
  5.9 kB     build\static\js\9615.d684fb27.chunk.js
  5.58 kB    build\static\js\9337.6f42a9cf.chunk.js
  5.56 kB    build\static\js\4962.cd8ab2ff.chunk.js
  5.54 kB    build\static\js\7185.31b18409.chunk.js
  5.48 kB    build\static\css\5139.20ddbdf1.chunk.css
  5.32 kB    build\static\js\2834.a983c726.chunk.js
  5.26 kB    build\static\js\2756.dee6555a.chunk.js
  4.88 kB    build\static\js\201.dca571bd.chunk.js
  4.83 kB    build\static\js\6687.c1e79027.chunk.js
  4.75 kB    build\static\js\3368.a4f1024f.chunk.js
  4.65 kB    build\static\js\4492.c8bb894e.chunk.js
  4.64 kB    build\static\js\2445.a769f04f.chunk.js
  4.58 kB    build\static\js\6215.7297a75e.chunk.js
  4.52 kB    build\static\js\6046.4a0ab75c.chunk.js
  4.05 kB    build\static\js\3268.7e8a8f5f.chunk.js
  3.86 kB    build\static\js\184.02cad749.chunk.js
  3.73 kB    build\static\js\7272.bb0259c6.chunk.js
  3.71 kB    build\static\js\367.7c7afe3b.chunk.js
  3.6 kB     build\static\js\6572.aa9dc260.chunk.js
  3.6 kB     build\static\js\9981.ce18854f.chunk.js
  3.58 kB    build\static\js\4471.1c9f8797.chunk.js
  3.51 kB    build\static\js\4241.4f51d31b.chunk.js
  3.07 kB    build\static\js\6465.867a270f.chunk.js
  2.94 kB    build\static\js\9362.2bdb4a99.chunk.js
  2.47 kB    build\static\js\5432.b427ced2.chunk.js
  2.3 kB     build\static\js\1531.eba8684e.chunk.js
  2.24 kB    build\static\js\738.92fe95e9.chunk.js
  2.21 kB    build\static\js\2587.a71c6a46.chunk.js
  1.79 kB    build\static\js\900.3c7dbb54.chunk.js
  1.77 kB    build\static\js\6453.8d2b574b.chunk.js
  838 B      build\static\js\7150.392fa455.chunk.js

The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.

The build folder is ready to be deployed.
You may serve it with a static server:

  serve -s build

Find out more about deployment here:

  https://cra.link/deployment
```

Command:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' -lc 'CI=true npx react-scripts test --watchAll=false'
```

Output:

```text
PASS src/utils/hashScroll.test.ts
PASS src/data/legacyHouseArchive.test.ts
PASS src/utils/leaderboardRanking.test.ts
PASS src/schemas/dataRightsRequests.test.ts
PASS src/lib/applicationLinks.test.ts
PASS src/lib/memberMatching.test.ts
PASS src/utils/matchCabinetRole.test.ts
PASS src/__meta__/playbookRoster.test.ts
PASS src/utils/generateSlug.test.ts
PASS src/utils/seasonalState.test.ts
PASS src/schemas/memberPhotoRequests.test.ts
PASS src/utils/wrapped.test.ts
PASS src/utils/calendar.test.ts
PASS src/lib/dateOnly.test.ts
PASS src/App.test.tsx
  ● Console

    console.error
      Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom/test-utils`. See https://react.dev/warnings/react-dom-test-utils for more info.

      4 |
      5 | test('renders VSA website', () => {
    > 6 |   render(<App />);
        |         ^
      7 |   // Check if the app renders without crashing
      8 |   expect(document.body).toBeInTheDocument();
      9 | });

      at printWarning (node_modules/react-dom/cjs/react-dom-test-utils.development.js:71:30)
      at error (node_modules/react-dom/cjs/react-dom-test-utils.development.js:45:7)
      at actWithWarning (node_modules/react-dom/cjs/react-dom-test-utils.development.js:1736:7)
      at node_modules/@testing-library/react/dist/act-compat.js:63:25
      at renderRoot (node_modules/@testing-library/react/dist/pure.js:159:26)
      at render (node_modules/@testing-library/react/dist/pure.js:246:10)
      at Object.<anonymous> (src/App.test.tsx:6:9)

    console.error
      Error: Uncaught [TypeError: Cannot read properties of undefined (reading 'matches')]
          at reportException (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\helpers\runtime-script-errors.js:66:24)
          at innerInvokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:341:9)
          at invokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:274:3)
          at HTMLUnknownElementImpl._dispatch (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:221:9)
          at HTMLUnknownElementImpl.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:94:17)
          at HTMLUnknownElement.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\generated\EventTarget.js:231:34)
          at Object.invokeGuardedCallbackDev (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4213:16)
          at invokeGuardedCallback (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4277:31)
          at beginWork$1 (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:27490:7)
          at performUnitOfWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26599:12)
          at workLoopSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26505:5)
          at renderRootSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26473:7)
          at performConcurrentWorkOnRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25777:74)
          at flushActQueue (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2667:24)
          at act (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2582:11)
          at actWithWarning (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom-test-utils.development.js:1740:10)
          at C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\act-compat.js:63:25
          at renderRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:159:26)
          at render (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:246:10)
          at Object.<anonymous> (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\App.test.tsx:6:9)
          at Promise.then.completed (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:391:28)
          at new Promise (<anonymous>)
          at callAsyncCircusFn (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:316:10)
          at _callCircusTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:218:40)
          at processTicksAndRejections (node:internal/process/task_queues:105:5)
          at _runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:155:3)
          at _runTestsForDescribeBlock (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:66:9)
          at run (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:25:3)
          at runAndTransformResultsToJestFormat (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:170:21)
          at jestAdapter (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:82:19)
          at runTestInternal (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:389:16)
          at runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:475:34)
          at Object.worker (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\testWorker.js:133:12) TypeError: Cannot read properties of undefined (reading 'matches')
          at getInitialTheme (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\context\ThemeContext.tsx:25:59)
          at mountState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:16167:20)
          at Object.useState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:16880:16)
          at useState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:1622:21)
          at ThemeProvider (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\context\ThemeContext.tsx:29:37)
          at renderWithHooks (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:15486:18)
          at mountIndeterminateComponent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:20103:13)
          at beginWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:21626:16)
          at HTMLUnknownElement.callCallback (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4164:14)
          at HTMLUnknownElement.callTheUserObjectsOperation (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
          at innerInvokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:338:25)
          at invokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:274:3)
          at HTMLUnknownElementImpl._dispatch (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:221:9)
          at HTMLUnknownElementImpl.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:94:17)
          at HTMLUnknownElement.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\generated\EventTarget.js:231:34)
          at Object.invokeGuardedCallbackDev (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4213:16)
          at invokeGuardedCallback (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4277:31)
          at beginWork$1 (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:27490:7)
          at performUnitOfWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26599:12)
          at workLoopSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26505:5)
          at renderRootSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26473:7)
          at performConcurrentWorkOnRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25777:74)
          at flushActQueue (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2667:24)
          at act (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2582:11)
          at actWithWarning (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom-test-utils.development.js:1740:10)
          at C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\act-compat.js:63:25
          at renderRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:159:26)
          at render (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:246:10)
          at Object.<anonymous> (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\App.test.tsx:6:9)
          at Promise.then.completed (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:391:28)
          at new Promise (<anonymous>)
          at callAsyncCircusFn (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:316:10)
          at _callCircusTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:218:40)
          at processTicksAndRejections (node:internal/process/task_queues:105:5)
          at _runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:155:3)
          at _runTestsForDescribeBlock (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:66:9)
          at run (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:25:3)
          at runAndTransformResultsToJestFormat (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:170:21)
          at jestAdapter (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:82:19)
          at runTestInternal (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:389:16)
          at runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:475:34)
          at Object.worker (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\testWorker.js:133:12)

      4 |
      5 | test('renders VSA website', () => {
    > 6 |   render(<App />);
        |         ^
      7 |   // Check if the app renders without crashing
      8 |   expect(document.body).toBeInTheDocument();
      9 | });

      at VirtualConsole.<anonymous> (node_modules/jsdom/lib/jsdom/virtual-console.js:29:45)
      at reportException (node_modules/jsdom/lib/jsdom/living/helpers/runtime-script-errors.js:70:28)
      at innerInvokeEventListeners (node_modules/jsdom/lib/jsdom/living/events/EventTarget-impl.js:341:9)
      at invokeEventListeners (node_modules/jsdom/lib/jsdom/living/events/EventTarget-impl.js:274:3)
      at HTMLUnknownElementImpl._dispatch (node_modules/jsdom/lib/jsdom/living/events\EventTarget-impl.js:221:9)
      at HTMLUnknownElementImpl.dispatchEvent (node_modules/jsdom/lib/jsdom/living/events\EventTarget-impl.js:94:17)
      at HTMLUnknownElement.dispatchEvent (node_modules/jsdom/lib/jsdom/living/generated/EventTarget.js:231:34)
      at Object.invokeGuardedCallbackDev (node_modules/react-dom/cjs/react-dom.development.js:4213:16)
      at invokeGuardedCallback (node_modules/react-dom/cjs/react-dom.development.js:4277:31)
      at beginWork$1 (node_modules/react-dom/cjs/react-dom.development.js:27490:7)
      at performUnitOfWork (node_modules/react-dom/cjs/react-dom.development.js:26599:12)
      at workLoopSync (node_modules/react-dom/cjs/react-dom.development.js:26505:5)
      at renderRootSync (node_modules/react-dom/cjs/react-dom.development.js:26473:7)
      at performConcurrentWorkOnRoot (node_modules/react-dom/cjs/react-dom.development.js:25777:74)
      at flushActQueue (node_modules/react/cjs/react.development.js:2667:24)
      at act (node_modules/react/cjs/react.development.js:2582:11)
      at actWithWarning (node_modules/react-dom/cjs/react-dom-test-utils.development.js:1740:10)
      at node_modules/@testing-library/react/dist/act-compat.js:63:25
      at renderRoot (node_modules/@testing-library/react/dist/pure.js:159:26)
      at render (node_modules/@testing-library/react/dist/pure.js:246:10)
      at Object.<anonymous> (src/App.test.tsx:6:9)

    console.error
      Error: Uncaught [TypeError: Cannot read properties of undefined (reading 'matches')]
          at reportException (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\helpers\runtime-script-errors.js:66:24)
          at innerInvokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:341:9)
          at invokeEventListeners (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:274:3)
          at HTMLUnknownElementImpl._dispatch (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:221:9)
          at HTMLUnknownElementImpl.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:94:17)
          at HTMLUnknownElement.dispatchEvent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jsdom\lib\jsdom\living\generated\EventTarget.js:231:34)
          at Object.invokeGuardedCallbackDev (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4213:16)
          at invokeGuardedCallback (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:4277:31)
          at beginWork$1 (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:27490:7)
          at performUnitOfWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26599:12)
          at workLoopSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26505:5)
          at renderRootSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26473:7)
          at recoverFromConcurrentError (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25889:20)
          at performConcurrentWorkOnRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25789:22)
          at flushActQueue (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2667:24)
          at act (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2582:11)
          at actWithWarning (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom-test-utils.development.js:1740:10)
          at C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\act-compat.js:63:25
          at renderRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:159:26)
          at render (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:246:10)
          at Object.<anonymous> (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\App.test.tsx:6:9)
          at Promise.then.completed (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:391:28)
          at new Promise (<anonymous>)
          at callAsyncCircusFn (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:316:10)
          at _callCircusTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:218:40)
          at processTicksAndRejections (node:internal/process/task_queues:105:5)
          at _runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:155:3)
          at _runTestsForDescribeBlock (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:66:9)
          at run (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:25:3)
          at runAndTransformResultsToJestFormat (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:170:21)
          at jestAdapter (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:82:19)
          at runTestInternal (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:389:16)
          at runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:475:34)
          at Object.worker (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\testWorker.js:133:12) TypeError: Cannot read properties of undefined (reading 'matches')
          at getInitialTheme (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\context\ThemeContext.tsx:25:59)
          at mountState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:16167:20)
          at Object.useState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:16880:16)
          at useState (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:1622:21)
          at ThemeProvider (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\context\ThemeContext.tsx:29:37)
          at renderWithHooks (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:15486:18)
          at mountIndeterminateComponent (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:20103:13)
          at beginWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:21626:16)
          at beginWork$1 (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:27465:14)
          at performUnitOfWork (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26599:12)
          at workLoopSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26505:5)
          at renderRootSync (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:26473:7)
          at recoverFromConcurrentError (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25889:20)
          at performConcurrentWorkOnRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom.development.js:25789:22)
          at flushActQueue (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2667:24)
          at act (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react\cjs\react.development.js:2582:11)
          at actWithWarning (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\react-dom\cjs\react-dom-test-utils.development.js:1740:10)
          at C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\act-compat.js:63:25
          at renderRoot (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:159:26)
          at render (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\@testing-library\react\dist\pure.js:246:10)
          at Object.<anonymous> (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\src\App.test.tsx:6:9)
          at Promise.then.completed (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:391:28)
          at new Promise (<anonymous>)
          at callAsyncCircusFn (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\utils.js:316:10)
          at _callCircusTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:218:40)
          at processTicksAndRejections (node:internal/process/task_queues:105:5)
          at _runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:155:3)
          at _runTestsForDescribeBlock (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:66:9)
          at run (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\run.js:25:3)
          at runAndTransformResultsToJestFormat (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:170:21)
          at jestAdapter (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:82:19)
          at runTestInternal (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:389:16)
          at runTest (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\runTest.js:475:34)
          at Object.worker (C:\Users\xiate\Documents\CS\vsa-worktrees\i359\node_modules\jest-runner\build\testWorker.js:133:12) {
        componentStack: '\n' +
          '    at ThemeProvider (C:\\Users\\xiate\\Documents\\CS\\vsa-worktrees\\i359\\src\\context\\ThemeContext.tsx:28:33)\n' +
          '    at QueryClientProvider (C:\\Users\\xiate\\Documents\\CS\\vsa-worktrees\\i359\\node_modules\\react-query\\lib\\react\\QueryClientProvider.js:45:21)\n' +
          '    at ErrorBoundary (C:\\Users\\xiate\\Documents\\CS\\vsa-worktrees\\i359\\src\\components\\common\\ErrorBoundary.tsx:16:60)\n' +
          '    at App'
      }

      41 |     }
      42 |
    > 43 |     console.error('Uncaught error:', error, errorInfo);
         |             ^
      44 |
      45 |     if (this.props.onError) {
      46 |       this.props.onError(error, errorInfo);

      at ErrorBoundary.componentDidCatch (src/components/common/ErrorBoundary.tsx:43:13)
      at ErrorBoundary.callback (node_modules/react-dom/cjs/react-dom.development.js:18785:12)
      at callCallback (node_modules/react-dom/cjs/react-dom.development.js:15036:12)
      at commitUpdateQueue (node_modules/react-dom/cjs/react-dom.development.js:15057:9)
      at commitLayoutEffectOnFiber (node_modules/react-dom/cjs/react-dom.development.js:23403:13)
      at commitLayoutMountEffects_complete (node_modules/react-dom/cjs/react-dom.development.js:24727:9)
      at commitLayoutEffects_begin (node_modules/react-dom/cjs/react-dom.development.js:24713:7)
      at commitLayoutEffects (node_modules/react-dom/cjs/react-dom.development.js:24651:3)
      at commitRootImpl (node_modules/react-dom/cjs/react-dom.development.js:26862:5)
      at commitRoot (node_modules/react-dom/cjs/react-dom.development.js:26721:5)
      at finishConcurrentRender (node_modules/react-dom/cjs/react-dom.development.js:25931:9)
      at performConcurrentWorkOnRoot (node_modules/react-dom/cjs/react-dom.development.js:25848:7)
      at flushActQueue (node_modules/react/cjs/react.development.js:2667:24)
      at act (node_modules/react/cjs/react.development.js:2582:11)
      at actWithWarning (node_modules/react-dom/cjs/react-dom-test-utils.development.js:1740:10)
      at node_modules/@testing-library/react/dist/act-compat.js:63:25
      at renderRoot (node_modules/@testing-library/react/dist/pure.js:159:26)
      at render (node_modules/@testing-library/react/dist/pure.js:246:10)
      at Object.<anonymous> (src/App.test.tsx:6:9)


Test Suites: 15 passed, 15 total
Tests:       126 passed, 126 total
Snapshots:   0 total
Time:        6.825 s
Ran all test suites.
```

### PowerShell note for the test command

The literal POSIX-style command fails directly in PowerShell, so the passing run above used Git Bash. This direct PowerShell attempt was also run:

Command:

```powershell
CI=true npx react-scripts test --watchAll=false
```

Output:

```text
CI=true: 
Line |
   2 |  CI=true npx react-scripts test --watchAll=false
     |  ~~~~~~~
     | The term 'CI=true' is not recognized as a name of a cmdlet, function, script file, or executable program.
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
```
