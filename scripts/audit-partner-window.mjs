import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const timestamp = (value) => typeof value === 'number' && Number.isFinite(value)
  ? value * 1000 : typeof value === 'string' ? Date.parse(value) : NaN;

// Inspection only: never rewrites partner values or implies scientific validity.
export function auditWindow(dataset) {
  const start = timestamp(dataset.window?.start);
  const end = timestamp(dataset.window?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Invalid declared window');
  if (!dataset.records_by_modality || typeof dataset.records_by_modality !== 'object') throw new Error('Missing modality groups');
  return Object.entries(dataset.records_by_modality).map(([modality, group]) => {
    if (!Array.isArray(group.records)) throw new Error(`Missing records: ${modality}`);
    let outsideWindow = 0;
    let unknownTimestamp = 0;
    let boundaryPrecision = 0;
    const times = [];
    for (const record of group.records) {
      const t = timestamp(record.timestamp);
      if (!Number.isFinite(t)) { unknownTimestamp++; continue; }
      times.push(t);
      // Date.parse truncates ISO sub-millisecond precision. Do not invent
      // out-of-window findings for differences below that resolution.
      if (t < start - 1 || t > end + 1) outsideWindow++;
      else if (Math.abs(t - start) <= 1 || Math.abs(t - end) <= 1) boundaryPrecision++;
    }
    return { modality, declaredCount: group.count, actualCount: group.records.length,
      countMatches: group.count === group.records.length, declaredCoherence: group.coherence,
      outsideWindow, unknownTimestamp, boundaryPrecision,
      firstTimestamp: times.length ? new Date(Math.min(...times)).toISOString() : null,
      lastTimestamp: times.length ? new Date(Math.max(...times)).toISOString() : null };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/audit-partner-window.mjs <sample-dataset.json>');
  const bytes = readFileSync(process.argv[2]);
  console.log(JSON.stringify({ sha256: createHash('sha256').update(bytes).digest('hex'),
    timestampConvention: 'Numeric timestamps interpreted as Unix seconds; string timestamps parsed as ISO dates. Window endpoints inclusive with 1 ms precision tolerance; boundaryPrecision counts near-boundary records requiring original-precision review. Sample intervals are not inferred.',
    groups: auditWindow(JSON.parse(bytes)) }, null, 2));
}
