/**
 * Entry for the PRIVATE, file-based recap preview built by
 * scripts/ace-recap/build-preview.ts. The snapshot is read from an inline
 * JSON block in the generated HTML (which lives outside the repo); this file
 * contains no data and is never part of the website bundle.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AceRecapSnapshot } from '../../../../../lib/aceRecap/recapSnapshot';
import { AceRecapPreview } from '../AceRecapPreview';

const el = document.getElementById('ace-recap-snapshot');
const snapshot = el ? (JSON.parse(el.textContent || 'null') as AceRecapSnapshot | null) : null;
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark', !!dark);
const root = createRoot(document.getElementById('root')!);
root.render(snapshot
  ? <AceRecapPreview snapshot={snapshot} />
  : <p style={{ padding: 24 }}>No snapshot embedded. Rebuild with scripts/ace-recap/build-preview.ts.</p>);
