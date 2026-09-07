import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseEnrichedObservation } from '../packages/disclosureos-schema/dist/index.js';
import { validateSensorManifest } from '../packages/disclosureos-instruments/dist/index.js';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const schemas = Object.fromEntries(Object.entries({
  observation: '../packages/disclosureos-schema/schema/enriched-observation.schema.json',
  manifest: '../packages/disclosureos-instruments/schema/sensor-manifest.schema.json',
}).map(([kind, path]) => [kind, ajv.compile(JSON.parse(readFileSync(new URL(path, import.meta.url))))]));
const cli = fileURLToPath(new URL('../packages/disclosureos-cli/dist/index.js', import.meta.url));

export function validateSurfaces(fixture) {
  if (!schemas[fixture.kind]) throw new Error(`Unsupported fixture kind: ${fixture.kind}`);
  const input = structuredClone(fixture.input);
  const original = JSON.stringify(input);
  const parsed = fixture.kind === 'observation' ? parseEnrichedObservation(input) : undefined;
  const runtime = fixture.kind === 'manifest' ? validateSensorManifest(input).length === 0 : parsed.success;
  if (parsed?.success && JSON.stringify(parsed.data) !== original) throw new Error(`Parser stripped or changed fixture ${fixture.id}`);
  const jsonSchema = schemas[fixture.kind](input);
  if (JSON.stringify(input) !== original) throw new Error(`Validator mutated fixture ${fixture.id}`);
  const directory = mkdtempSync(join(tmpdir(), 'disclosureos-conformance-'));
  try {
    const path = join(directory, 'fixture.json');
    writeFileSync(path, JSON.stringify(input));
    const result = {};
    for (const strict of [false, true]) {
      const args = fixture.kind === 'manifest' ? ['manifest', 'validate'] : ['validate'];
      const child = spawnSync(process.execPath, [cli, ...args, path, '--json', ...(strict ? ['--strict'] : [])],
        { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
      if (child.error || child.signal || ![0, 1].includes(child.status)) throw new Error(`CLI execution failed: ${child.error ?? child.stderr}`);
      const output = JSON.parse(child.stdout);
      if (typeof output.valid !== 'boolean' || !Array.isArray(output.files) || output.files.length !== 1 || output.files[0].valid !== output.valid || (child.status === 0) !== output.valid) {
        throw new Error(`CLI JSON/exit contract disagrees for ${fixture.id}`);
      }
      result[strict ? 'cliStrict' : 'cli'] = { accepts: output.valid,
        warnings: output.files[0].warnings?.length ?? 0 };
    }
    return { runtime, jsonSchema, ...result };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
