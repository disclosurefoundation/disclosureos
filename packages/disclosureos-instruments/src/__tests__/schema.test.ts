import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instrumentsJsonSchema, INSTRUMENTS_SCHEMA_VERSION } from '../schema';

const committedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../schema/sensor-manifest.schema.json',
);
const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

describe('instruments JSON Schema artifact', () => {
  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(instrumentsJsonSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(INSTRUMENTS_SCHEMA_VERSION);
  });

  it('uses the canonical hosted $id', () => {
    expect(committed['$id']).toBe(
      `https://os.disclosure.org/schema/instruments/${INSTRUMENTS_SCHEMA_VERSION}/sensor-manifest.json`,
    );
  });
});
