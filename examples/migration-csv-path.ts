/**
 * DisclosureOS CSV migration path — parse a real CSV and produce Observations.
 *
 *   1. Parse a CSV file with csv-parse
 *   2. Map rows with honest date precision and guarded enums
 *   3. Quarantine failures instead of dropping them
 *   4. Validate with parseEnrichedObservation
 *   5. Score completeness
 *
 * Run it:  pnpm --filter @disclosureos/examples migration-csv-path
 *
 * See the Data Migration guide: https://os.disclosure.org/docs/platform/guides/data-migration
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { createObservation } from '@disclosureos/records/factories';
import { isObjectShape } from '@disclosureos/records/guards';
import type { Observation, TemporalData } from '@disclosureos/records';
import { parseEnrichedObservation } from '@disclosureos/schema';
import { getCompleteness } from '@disclosureos/scoring';

interface CsvRow {
  case_id: string;
  date_reported: string;
  city: string;
  state: string;
  country: string;
  lat: string;
  lng: string;
  shape: string;
  duration_minutes: string;
  summary: string;
  witness_count: string;
}

function mapTemporal(raw: string, durationMin?: number): TemporalData {
  const base: Partial<TemporalData> = durationMin
    ? { durationSeconds: durationMin * 60 }
    : {};

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ...base, date: raw, dateCertainty: 'approximate' } as TemporalData;
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return {
      ...base,
      date: `${raw}-01`,
      dateCertainty: 'approximate',
      dateGranularity: 'month',
    } as TemporalData;
  }
  if (/^\d{4}$/.test(raw)) {
    return {
      ...base,
      date: `${raw}-01-01`,
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

const DATA_SOURCE_ID = 'nuforc-csv-export';

function migrateRow(row: CsvRow): Observation {
  const lat = row.lat ? parseFloat(row.lat) : undefined;
  const lng = row.lng ? parseFloat(row.lng) : undefined;
  const duration = row.duration_minutes ? parseFloat(row.duration_minutes) : undefined;
  const witnessCount = row.witness_count ? parseInt(row.witness_count, 10) : undefined;
  const locationName = [row.city, row.state].filter(Boolean).join(', ') || 'Unknown';

  return createObservation(
    {
      temporal: mapTemporal(row.date_reported, duration),
      location: {
        name: locationName,
        country: row.country || 'Unknown',
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        siteType: 'unknown',
        coordinatePrecision: lat ? 'locality' : 'region',
      },
      summary: row.summary || undefined,
      objectCharacteristics: isObjectShape(row.shape)
        ? { shape: row.shape }
        : undefined,
      witnesses: witnessCount ? { count: witnessCount } : undefined,
      dataSourceId: DATA_SOURCE_ID,
      extensions: {
        migration: { rawRow: row, source: 'csv' },
      },
    },
    { id: `nuforc-csv-${row.case_id}`, status: 'draft' },
  );
}

// Load and parse CSV
const csvContent = readFileSync(
  new URL('./migration-csv-fixture.csv', import.meta.url),
  'utf-8',
);

const rows: CsvRow[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

console.log(`\nparsed ${rows.length} CSV rows\n`);

// Migrate with quarantine
const migrated: Observation[] = [];
const quarantine: { row: CsvRow; error: string }[] = [];

for (const row of rows) {
  try {
    migrated.push(migrateRow(row));
  } catch (err) {
    quarantine.push({ row, error: String(err) });
  }
}

console.log(`migrated ${migrated.length}, quarantined ${quarantine.length}\n`);

// Validate
let validCount = 0;
for (const obs of migrated) {
  const result = parseEnrichedObservation(obs);
  if (result.success) {
    validCount++;
  } else {
    console.log(`  warning ${obs.id}: ${result.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
}
console.log(`validated: ${validCount}/${migrated.length}\n`);

// Score completeness
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
