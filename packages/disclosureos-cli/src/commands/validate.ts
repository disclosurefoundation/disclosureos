import type { ParsedArgs } from '../utils/args';
import { readJSON, findJSONFiles } from '../utils/fs';
import { heading, success, error, warn, dim, label, BRAND } from '../output/format';
import type { ValidationIssue } from '@disclosureos/records';
import { parseEvidenceRef } from '@disclosureos/records/shared';
import { parseEnrichedObservation } from '@disclosureos/schema';

/** Structured result for a single file, emitted in --json mode. */
export interface FileResult {
  file: string;
  valid: boolean;
  errors: { path: string; message: string }[];
  warnings: { path: string; message: string }[];
}

/** Top-level structured output from --json mode. */
export interface ValidateJsonOutput {
  files: FileResult[];
  emptyTargets: string[];
  totals: {
    files: number;
    errors: number;
    warnings: number;
    emptyTargets: number;
  };
  valid: boolean;
}

export function validate(args: ParsedArgs): void {
  if (args.flags['help']) {
    printUsage();
    return;
  }

  const targets = [args.subcommand, ...args.positional].filter((t): t is string => !!t);
  if (targets.length === 0) {
    printUsage();
    return;
  }

  const recursive = !!args.flags['recursive'];
  const strict = !!args.flags['strict'];
  const jsonMode = !!args.flags['json'];

  const seen = new Set<string>();
  const files: string[] = [];
  const emptyTargets: string[] = [];

  for (const target of targets) {
    const found = findJSONFiles(target, recursive);
    if (found.length === 0) {
      emptyTargets.push(target);
      continue;
    }
    for (const f of found) {
      if (!seen.has(f)) {
        seen.add(f);
        files.push(f);
      }
    }
  }

  if (jsonMode) {
    runJsonMode(files, emptyTargets, strict);
    return;
  }

  for (const t of emptyTargets) {
    console.log(error(`No JSON files found at: ${t}`));
  }

  if (files.length === 0) {
    process.exit(1);
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const { errors: fileErrors, warnings } = validateFile(file, strict);
    totalErrors += fileErrors;
    totalWarnings += warnings;
  }

  console.log('');
  if (totalErrors === 0 && emptyTargets.length === 0) {
    const warnSuffix = totalWarnings > 0 ? ` (${totalWarnings} warning${totalWarnings > 1 ? 's' : ''})` : '';
    console.log(success(`All ${files.length} file(s) valid${warnSuffix}`));
  } else {
    if (totalErrors > 0) {
      console.log(error(`${totalErrors} error(s) across ${files.length} file(s)`));
    }
    if (emptyTargets.length > 0) {
      console.log(error(`${emptyTargets.length} path(s) matched no JSON file`));
    }
    process.exit(1);
  }
}

function runJsonMode(files: string[], emptyTargets: string[], strict: boolean): void {
  const fileResults: FileResult[] = [];

  for (const file of files) {
    fileResults.push(validateFileStructured(file, strict));
  }

  const totalErrors = fileResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = fileResults.reduce((sum, r) => sum + r.warnings.length, 0);

  const output: ValidateJsonOutput = {
    files: fileResults,
    emptyTargets,
    totals: {
      files: files.length,
      errors: totalErrors,
      warnings: totalWarnings,
      emptyTargets: emptyTargets.length,
    },
    valid: totalErrors === 0 && emptyTargets.length === 0,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.valid) {
    process.exit(1);
  }
}

function validateFileStructured(filePath: string, strict: boolean): FileResult {
  let data: unknown;
  try {
    data = readJSON(filePath);
  } catch {
    return {
      file: filePath,
      valid: false,
      errors: [{ path: '', message: 'Failed to parse JSON' }],
      warnings: [],
    };
  }

  if (!data || typeof data !== 'object') {
    return {
      file: filePath,
      valid: false,
      errors: [{ path: '', message: 'Not a valid JSON object' }],
      warnings: [],
    };
  }

  const obs = data as Record<string, unknown>;
  const structuralErrors = parseEnrichedObservation(obs).issues;
  const semanticErrors = validateSemantics(obs);
  const warnings = [...validateEvidenceRefs(obs), ...(strict ? validateStrict(obs) : [])];
  const allErrors = [...structuralErrors, ...semanticErrors];

  return {
    file: filePath,
    valid: allErrors.length === 0,
    errors: allErrors.map((e) => ({ path: e.path, message: e.message })),
    warnings: warnings.map((w) => ({ path: w.path, message: w.message })),
  };
}

function validateFile(filePath: string, strict: boolean): { errors: number; warnings: number } {
  let data: unknown;
  try {
    data = readJSON(filePath);
  } catch {
    console.log(error(`Failed to parse: ${filePath}`));
    return { errors: 1, warnings: 0 };
  }

  if (!data || typeof data !== 'object') {
    console.log(error(`${filePath}: not a valid JSON object`));
    return { errors: 1, warnings: 0 };
  }

  const obs = data as Record<string, unknown>;
  const structuralErrors = parseEnrichedObservation(obs).issues;
  const semanticErrors = validateSemantics(obs);
  const warnings = [...validateEvidenceRefs(obs), ...(strict ? validateStrict(obs) : [])];

  const allErrors = [...structuralErrors, ...semanticErrors];

  if (allErrors.length > 0 || warnings.length > 0) {
    console.log(`\n${dim(filePath)}`);
    for (const e of allErrors) {
      console.log(`  ${error(`${e.path}: ${e.message}`)}`);
    }
    for (const w of warnings) {
      console.log(`  ${warn(`${w.path}: ${w.message}`)}`);
    }
  }

  return { errors: allErrors.length, warnings: warnings.length };
}

const EVIDENCE_ID_KEY: Record<string, string> = {
  media: 'id',
  sensor: 'id',
  physical: 'id',
  testimony: 'statementId',
};

function readId(item: unknown, key: string): string | undefined {
  if (item && typeof item === 'object') {
    const value = (item as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function addIds(set: Set<string>, items: unknown, key: string): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const id = readId(item, key);
    if (id) set.add(id);
  }
}

function collectEvidenceIds(obs: Record<string, unknown>): Record<string, Set<string>> {
  const ids = {
    media: new Set<string>(),
    sensor: new Set<string>(),
    physical: new Set<string>(),
    testimony: new Set<string>(),
  };

  addIds(ids.media, obs['media'], 'id');
  const featured = readId(obs['featuredMedia'], 'id');
  if (featured) ids.media.add(featured);

  const sensorEvidence = obs['sensorEvidence'];
  if (sensorEvidence && typeof sensorEvidence === 'object') {
    addIds(ids.sensor, (sensorEvidence as Record<string, unknown>)['sensors'], 'id');
  }

  addIds(ids.physical, obs['physicalEvidence'], 'id');
  addIds(ids.testimony, obs['testimony'], 'statementId');

  return ids;
}

function collectClaimRefs(obs: Record<string, unknown>): { path: string; refs: string[] }[] {
  const out: { path: string; refs: string[] }[] = [];

  const pushClaim = (path: string, claim: unknown): void => {
    if (!claim || typeof claim !== 'object') return;
    const refs = (claim as Record<string, unknown>)['evidenceRefs'];
    if (Array.isArray(refs)) {
      out.push({ path, refs: refs.filter((r): r is string => typeof r === 'string') });
    }
  };

  const assessments = obs['observableAssessments'];
  if (assessments && typeof assessments === 'object') {
    for (const domain of ['technology', 'biologics'] as const) {
      const group = (assessments as Record<string, unknown>)[domain];
      if (!group || typeof group !== 'object') continue;
      for (const [observableId, claims] of Object.entries(group as Record<string, unknown>)) {
        if (Array.isArray(claims)) {
          claims.forEach((c, i) => pushClaim(`observableAssessments.${domain}.${observableId}[${i}]`, c));
        }
      }
    }
  }

  if (Array.isArray(obs['origin'])) {
    (obs['origin'] as unknown[]).forEach((c, i) => pushClaim(`origin[${i}]`, c));
  }

  return out;
}

function validateEvidenceRefs(obs: Record<string, unknown>): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const available = collectEvidenceIds(obs);

  for (const { path, refs } of collectClaimRefs(obs)) {
    refs.forEach((ref, i) => {
      const refPath = `${path}.evidenceRefs[${i}]`;
      const parsed = parseEvidenceRef(ref);
      if (!parsed) {
        warnings.push({ path: refPath, message: `malformed evidence ref "${ref}" (expected "<kind>:<id>")` });
        return;
      }
      const pool = available[parsed.kind];
      const key = EVIDENCE_ID_KEY[parsed.kind] ?? 'id';
      if (!pool || !pool.has(parsed.id)) {
        warnings.push({
          path: refPath,
          message: `dangling evidence ref "${ref}" — no ${parsed.kind} with ${key} "${parsed.id}" in record`,
        });
      }
    });
  }

  return warnings;
}

function validateStrict(obs: Record<string, unknown>): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const recommended = ['summary', 'description', 'objectCharacteristics', 'sourceData', 'witnesses'];

  for (const field of recommended) {
    if (obs[field] == null) {
      warnings.push({ path: field, message: `recommended field missing (strict mode)` });
    }
  }

  return warnings;
}

function validateSemantics(obs: Record<string, unknown>): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  const numericField = (
    parent: unknown,
    key: string,
    path: string,
    { min }: { min: number },
  ): void => {
    if (parent == null || typeof parent !== 'object') return;
    const value = (parent as Record<string, unknown>)[key];
    if (typeof value === 'number' && value < min) {
      errors.push({ path, message: `${key} cannot be less than ${min}` });
    }
  };

  numericField(obs['temporal'], 'durationSeconds', 'temporal.durationSeconds', { min: 0 });
  numericField(obs['movement'], 'speedKmh', 'movement.speedKmh', { min: 0 });
  numericField(obs['movement'], 'altitudeMeters', 'movement.altitudeMeters', { min: 0 });
  numericField(obs['witnesses'], 'count', 'witnesses.count', { min: 0 });
  numericField(obs['objectCharacteristics'], 'numberObserved', 'objectCharacteristics.numberObserved', { min: 0 });

  return errors;
}

function printUsage(): void {
  console.log(heading(`${BRAND} validate`));
  console.log(`\nValidate observation JSON files against the full schema.\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos validate <path...> [options]\n`);
  console.log(`${dim('Paths:')}`);
  console.log(`  Accepts one or more files, directories, or shell globs. Results are`);
  console.log(`  deduped, and any path matching no JSON fails the run (never silently skipped).\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --recursive, -r      Validate all JSON files in directories recursively`);
  console.log(`  --strict, -s         Warn on missing recommended fields`);
  console.log(`  --json, -j           Output results as structured JSON (for CI and scripts)`);
  console.log(`  --help, -h           Show this help message\n`);
  console.log(`${dim('Validation checks:')}`);
  console.log(`  • Required fields (id, temporal, location, status, createdAt, updatedAt)`);
  console.log(`  • Temporal type correctness (ISO date, certainty, granularity, range, relative)`);
  console.log(`  • Observable assessment levels and IDs (if present)`);
  console.log(`  • OCS node IDs in origin classifications (if present)`);
  console.log(`  • Unknown top-level keys rejected (third-party data belongs under "extensions")`);
  console.log(`  • Evidence refs on claims resolve to in-record evidence (warns on dangling)`);
  console.log(`  • Semantic sanity (non-negative duration, speed, counts)\n`);
  console.log(`${dim('Examples:')}`);
  console.log(`  disclosureos validate ./data/nimitz.json`);
  console.log(`  disclosureos validate ./data/ --recursive`);
  console.log(`  disclosureos validate ./data/*.json`);
  console.log(`  disclosureos validate ./data/*.json --json`);
  console.log(`  disclosureos validate ./a.json ./b.json --strict\n`);
}
