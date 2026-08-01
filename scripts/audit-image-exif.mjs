/**
 * Audit committed image assets for embedded camera metadata (EXIF).
 *
 * WHY THIS EXISTS
 * ---------------
 * This repository is public. Every image tracked by git is readable — and
 * forkable — by anyone, permanently. Camera originals carry an EXIF block that
 * can include the device model, the capture timestamp, and GPS coordinates.
 * For photographs of identifiable students that turns "a headshot on the VSA
 * website" into "where and when this person was photographed", which is a
 * materially different disclosure and one nobody consented to. See issue #359.
 *
 * The consent flow in docs/member-photo-requests.md governs runtime uploads
 * into Supabase Storage. It does NOT govern images committed to git. This
 * script covers that second, ungoverned pathway.
 *
 * READ-ONLY. It never modifies, moves, or deletes an image.
 *
 * NOTE ON REMEDIATION: stripping EXIF at HEAD does not remove it from git
 * history. A clean report here means "no new exposure is being added", not
 * "the historical exposure is resolved" — that requires a deliberate history
 * decision (compare #353, step 6).
 *
 * Usage:
 *   node scripts/audit-image-exif.mjs           # human-readable report
 *   node scripts/audit-image-exif.mjs --json    # machine-readable
 *   node scripts/audit-image-exif.mjs --quiet   # findings only
 *
 * Exit codes:
 *   0  no GPS coordinates found
 *   1  at least one image carries GPS coordinates (suitable as a CI gate)
 *   2  the audit could not run
 *
 * No dependencies — Node stdlib only, so it runs before `npm install`.
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|avif|tiff?)$/i;

// EXIF tags worth surfacing. 0x8825 points at the nested GPS IFD.
const TIFF_TAGS = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x8825: 'GPSIFD',
  0x9003: 'DateTimeOriginal',
};

const GPS_TAGS = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0006: 'GPSAltitude',
  0x001d: 'GPSDateStamp',
};

// EXIF type id -> bytes per component.
const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/**
 * Read one IFD (image file directory). `tiffStart` anchors all offsets, which
 * in EXIF are relative to the start of the TIFF header rather than the file.
 */
function readIfd(view, tiffStart, ifdOffset, little, tagMap, depth = 0) {
  const out = {};
  if (ifdOffset + 2 > view.byteLength) return out;

  const count = view.getUint16(ifdOffset, little);
  // A plausible directory is small; anything larger means we mis-located it.
  if (count > 512) return out;

  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const components = view.getUint32(entry + 4, little);
    const name = tagMap[tag];
    if (!name || !TYPE_SIZES[type]) continue;

    const byteLength = TYPE_SIZES[type] * components;
    // Values of 4 bytes or fewer are stored inline in the offset field.
    const valueOffset =
      byteLength <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
    if (valueOffset + byteLength > view.byteLength) continue;

    if (name === 'GPSIFD') {
      if (depth === 0) {
        const gpsOffset = tiffStart + view.getUint32(entry + 8, little);
        const gps = readIfd(view, tiffStart, gpsOffset, little, GPS_TAGS, 1);
        if (Object.keys(gps).length > 0) out.GPS = gps;
      }
    } else if (type === 2) {
      // ASCII, NUL-terminated.
      const bytes = new Uint8Array(view.buffer, view.byteOffset + valueOffset, byteLength);
      const end = bytes.indexOf(0);
      out[name] = new TextDecoder()
        .decode(end === -1 ? bytes : bytes.subarray(0, end))
        .trim();
    } else if (type === 5 && components <= 3) {
      // RATIONAL — GPS coordinates arrive as [degrees, minutes, seconds].
      const parts = [];
      for (let k = 0; k < components; k += 1) {
        const numerator = view.getUint32(valueOffset + k * 8, little);
        const denominator = view.getUint32(valueOffset + k * 8 + 4, little);
        parts.push(denominator === 0 ? 0 : numerator / denominator);
      }
      out[name] = parts;
    } else if (type === 3) {
      out[name] = view.getUint16(valueOffset, little);
    }
  }
  return out;
}

/** Locate the EXIF block and parse it. Returns null when there is none. */
function readExif(buffer) {
  // "Exif\0\0" precedes the TIFF header in JPEG APP1, PNG eXIf, and HEIC alike,
  // so searching for it avoids writing three container parsers.
  //
  // The first match is not always the real one: in HEIC the string also appears
  // inside the `infe` item-info box, several KB before the actual EXIF payload.
  // Trusting the first hit made this script silently skip every HEIC — i.e. the
  // straight-from-camera originals, which are exactly the files most likely to
  // carry GPS. So keep scanning until a match is followed by a valid TIFF header.
  const marker = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);

  for (let index = buffer.indexOf(marker); index !== -1; index = buffer.indexOf(marker, index + 1)) {
    const tiffStart = index + marker.length;
    if (tiffStart + 8 > buffer.length) return null;

    const byteOrder = buffer.readUInt16BE(tiffStart);
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) continue;
    const little = byteOrder === 0x4949;

    // A real TIFF header carries the magic number 42 after the byte order.
    if (view.getUint16(tiffStart + 2, little) !== 42) continue;

    const firstIfd = view.getUint32(tiffStart + 4, little);
    const parsed = readIfd(view, tiffStart, tiffStart + firstIfd, little, TIFF_TAGS);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  return null;
}

/** [deg, min, sec] -> signed decimal degrees. */
function toDecimal(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 2) return null;
  const [deg = 0, min = 0, sec = 0] = parts;
  const magnitude = deg + min / 60 + sec / 3600;
  return /^[SW]$/i.test(ref ?? '') ? -magnitude : magnitude;
}

function trackedImages() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((f) => f && IMAGE_EXTENSIONS.test(f));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const quiet = args.has('--quiet');

  let files;
  try {
    files = trackedImages();
  } catch (error) {
    console.error('Could not list tracked files — is this a git repository?');
    console.error(error.message);
    process.exit(2);
  }

  const withGps = [];
  const withMetadata = [];
  const unreadable = [];

  for (const file of files) {
    let exif;
    try {
      exif = readExif(readFileSync(file));
    } catch (error) {
      unreadable.push({ file, reason: error.message });
      continue;
    }
    if (!exif) continue;

    if (exif.GPS) {
      const gps = exif.GPS;
      withGps.push({
        file,
        latitude: toDecimal(gps.GPSLatitude, gps.GPSLatitudeRef),
        longitude: toDecimal(gps.GPSLongitude, gps.GPSLongitudeRef),
        altitude: Array.isArray(gps.GPSAltitude) ? gps.GPSAltitude[0] : undefined,
        dateStamp: gps.GPSDateStamp,
      });
    }

    const descriptive = {};
    for (const key of ['Make', 'Model', 'DateTimeOriginal', 'DateTime', 'Artist', 'Copyright']) {
      if (exif[key]) descriptive[key] = exif[key];
    }
    if (Object.keys(descriptive).length > 0) withMetadata.push({ file, ...descriptive });
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        { scanned: files.length, withGps, withMetadata, unreadable },
        null,
        2,
      ),
    );
    process.exit(withGps.length > 0 ? 1 : 0);
  }

  if (!quiet) {
    console.log(`Scanned ${files.length} git-tracked images.\n`);
  }

  if (withGps.length > 0) {
    console.log(`GPS COORDINATES — ${withGps.length} image(s)`);
    console.log('  These disclose where a photo was taken. Highest severity.\n');
    for (const hit of withGps) {
      const lat = hit.latitude?.toFixed(5) ?? '?';
      const lon = hit.longitude?.toFixed(5) ?? '?';
      console.log(`  ${hit.file}`);
      console.log(`      ${lat}, ${lon}${hit.dateStamp ? `  (${hit.dateStamp})` : ''}`);
    }
    console.log('');
  }

  if (withMetadata.length > 0) {
    console.log(`CAMERA / TIMESTAMP METADATA — ${withMetadata.length} image(s)`);
    for (const hit of withMetadata) {
      const { file, ...rest } = hit;
      const summary = Object.entries(rest)
        .map(([k, v]) => `${k}=${v}`)
        .join('  ');
      console.log(`  ${file}\n      ${summary}`);
    }
    console.log('');
  }

  if (unreadable.length > 0 && !quiet) {
    console.log(`Unreadable — ${unreadable.length} file(s)`);
    for (const { file, reason } of unreadable) console.log(`  ${file}: ${reason}`);
    console.log('');
  }

  if (withGps.length === 0 && withMetadata.length === 0) {
    console.log('No embedded camera metadata found in tracked images.');
  } else {
    console.log(
      'Remediation strips EXIF at HEAD only. The data stays in git history\n' +
        'until a deliberate history decision is made — see issue #359.',
    );
  }

  process.exit(withGps.length > 0 ? 1 : 0);
}

main();
