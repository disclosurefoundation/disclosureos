/**
 * DisclosureOS migration path — convert source rows to validated Observations.
 *
 *   Load source     → read a JSON fixture (stand-in for CSV / database export)
 *   Map             → one function per row, with honest date precision and guarded enums
 *   Quarantine      → rows that fail validation are kept, never dropped
 *   Validate        → parseEnrichedObservation as the second gate
 *   Score           → measure completeness of what was produced
 *
 * Run it:  pnpm --filter @disclosureos/examples migration-path
 *
 * See the Data Migration guide: https://os.disclosure.org/docs/platform/guides/data-migration
 */
import { readFileSync } from 'node:fs';
import { createObservation } from '@disclosureos/records/factories';
import { isObjectShape } from '@disclosureos/records/guards';
import type { Observation, TemporalData } from '@disclosureos/records';
import { parseEnrichedObservation } from '@disclosureos/schema';
import { getCompleteness } from '@disclosureos/scoring';

// ------------------------------------------------------------------
// 1. Define the source row shape
// ------------------------------------------------------------------
interface SourceRow {
  case_id: string;
  date: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  shape?: string;
  duration_min?: number;
  summary?: string;
  witness_count?: number;
  source_disposition?: string;
}

// ------------------------------------------------------------------
// 2. Date mapping — honest precision, never lying about certainty
// ------------------------------------------------------------------
function mapTemporal(date: string, durationMin?: number): TemporalData {
  const base: Partial<TemporalData> = durationMin
    ? { durationSeconds: durationMin * 60 }
    : {};

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ...base, date, dateCertainty: 'approximate' } as TemporalData;
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    return {
      ...base,
      date: `${date}-01`,
      dateCertainty: 'approximate',
      dateGranularity: 'month',
    } as TemporalData;
  }
  if (/^\d{4}$/.test(date)) {
    return {
      ...base,
      date: `${date}-01-01`,
      dateCertainty: 'estimated',
      dateGranularity: 'year',
    } as TemporalData;
  }
  return {
    ...base,
    date: '1900-01-01',
    dateCertainty: 'unknown',
    dateGranularity: 'unknown',
  } as TemporalData;
}

// ------------------------------------------------------------------
// 3. Row mapper — stable IDs, guarded enums, raw row in extensions
// ------------------------------------------------------------------
const DATA_SOURCE_ID = 'nuforc-sample-export';

function migrateRow(row: SourceRow): Observation {
  return createObservation(
    {
      temporal: mapTemporal(row.date, row.duration_min),
      location: {
        name: `${row.city}, ${row.state}`,
        country: 'United States',
        latitude: row.lat ?? 0,
        longitude: row.lng ?? 0,
        siteType: 'unknown',
        coordinatePrecision: row.lat ? 'locality' : 'region',
      },
      summary: row.summary,
      objectCharacteristics: isObjectShape(row.shape)
        ? { shape: row.shape }
        : undefined,
      witnesses: row.witness_count
        ? { count: row.witness_count }
        : undefined,
      dataSourceId: DATA_SOURCE_ID,
      extensions: {
        migration: {
          rawRow: row,
          sourceDisposition: row.source_disposition,
        },
      },
    },
    { id: `nuforc-${row.case_id}`, status: 'draft' },
  );
}

// ------------------------------------------------------------------
// 4. Load, migrate, quarantine
// ------------------------------------------------------------------
const raw: SourceRow[] = JSON.parse(
  readFileSync(new URL('./migration-fixture.json', import.meta.url), 'utf-8'),
);

const migrated: Observation[] = [];
const quarantine: { row: SourceRow; error: string }[] = [];

for (const row of raw) {
  try {
    migrated.push(migrateRow(row));
  } catch (err) {
    quarantine.push({ row, error: String(err) });
  }
}

console.log(`\nmigrated ${migrated.length}, quarantined ${quarantine.length}\n`);

// ------------------------------------------------------------------
// 5. Validate — parseEnrichedObservation as a second gate
// ------------------------------------------------------------------
let validCount = 0;
for (const obs of migrated) {
  const result = parseEnrichedObservation(obs);
  if (result.success) {
    validCount++;
  } else {
    console.log(`  ⚠ ${obs.id}: ${result.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
}
console.log(`validated: ${validCount}/${migrated.length}\n`);

// ------------------------------------------------------------------
// 6. Score — measure completeness of what was produced
// ------------------------------------------------------------------
const scores = migrated.map((o) => getCompleteness(o).percentage);
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

for (let i = 0; i < migrated.length; i++) {
  console.log(`  ${migrated[i]!.id}: ${scores[i]}% completeness`);
}
console.log(`\n  mean completeness: ${mean.toFixed(1)}%`);

if (quarantine.length > 0) {
  console.log(`\nquarantined rows:`);
  for (const q of quarantine) {
    console.log(`  ${q.row.case_id}: ${q.error}`);
  }
}
