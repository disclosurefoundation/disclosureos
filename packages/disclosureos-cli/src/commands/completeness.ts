import type { ParsedArgs } from '../utils/args';
import { readJSON, findJSONFiles } from '../utils/fs';
import { heading, success, error, dim, BRAND } from '../output/format';
import { parseEnrichedObservation } from '@disclosureos/schema';
import { getCompleteness } from '@disclosureos/scoring';

export interface FileCompletenessResult {
  file: string;
  valid: boolean;
  percentage: number;
  requiredPercentage: number;
  present: number;
  total: number;
  missing: string[];
  error?: string;
}

export interface CompletenessJsonOutput {
  files: FileCompletenessResult[];
  emptyTargets: string[];
  totals: {
    files: number;
    meanPercentage: number;
    meanRequiredPercentage: number;
    emptyTargets: number;
  };
  valid: boolean;
}

export function completeness(args: ParsedArgs): void {
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
    runJsonMode(files, emptyTargets);
    return;
  }

  for (const t of emptyTargets) {
    console.log(error(`No JSON files found at: ${t}`));
  }

  if (files.length === 0) {
    process.exit(1);
  }

  let hasErrors = false;
  const percentages: number[] = [];
  const reqPercentages: number[] = [];

  for (const file of files) {
    const result = scoreFile(file);
    if (!result.valid) {
      hasErrors = true;
      continue;
    }
    percentages.push(result.percentage);
    reqPercentages.push(result.requiredPercentage);
  }

  console.log('');
  if (hasErrors || emptyTargets.length > 0) {
    console.log(error('Some files could not be scored (see errors above).'));
    process.exit(1);
  }

  const mean = avg(percentages);
  const reqMean = avg(reqPercentages);
  console.log(
    success(
      `${files.length} file(s) scored — mean completeness ${mean}%, required fields ${reqMean}%`,
    ),
  );
}

function avg(values: number[]): number {
  return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

function scoreFile(
  filePath: string,
): FileCompletenessResult {
  let data: unknown;
  try {
    data = readJSON(filePath);
  } catch {
    console.log(error(`Failed to parse: ${filePath}`));
    return emptyResult(filePath, 'Failed to parse JSON');
  }

  if (!data || typeof data !== 'object') {
    console.log(error(`${filePath}: not a valid JSON object`));
    return emptyResult(filePath, 'Not a valid JSON object');
  }

  const parsed = parseEnrichedObservation(data);
  if (!parsed.success) {
    console.log(error(`${filePath}: invalid observation (${parsed.issues.length} issue${parsed.issues.length !== 1 ? 's' : ''})`));
    for (const issue of parsed.issues.slice(0, 5)) {
      console.log(`  ${dim(`${issue.path}: ${issue.message}`)}`);
    }
    return emptyResult(filePath, 'Invalid observation');
  }

  const comp = getCompleteness(data as Record<string, unknown>);

  console.log(`\n${dim(filePath)}`);
  console.log(`  Completeness: ${comp.percentage}%  (${comp.present}/${comp.total} fields)`);
  console.log(`  Required:     ${comp.requiredPercentage}%  (${comp.requiredPresent}/${comp.requiredTotal})`);
  if (comp.missing.length > 0) {
    const shown = comp.missing.slice(0, 10);
    console.log(`  Missing (top ${shown.length}):`);
    for (const path of shown) {
      console.log(`    ${dim('•')} ${path}`);
    }
    if (comp.missing.length > shown.length) {
      console.log(`    ${dim(`… and ${comp.missing.length - shown.length} more`)}`);
    }
  }

  return {
    file: filePath,
    valid: true,
    percentage: comp.percentage,
    requiredPercentage: comp.requiredPercentage,
    present: comp.present,
    total: comp.total,
    missing: comp.missing,
  };
}

function emptyResult(file: string, errorMsg: string): FileCompletenessResult {
  return {
    file,
    valid: false,
    percentage: 0,
    requiredPercentage: 0,
    present: 0,
    total: 0,
    missing: [],
    error: errorMsg,
  };
}

function runJsonMode(files: string[], emptyTargets: string[]): void {
  const fileResults: FileCompletenessResult[] = [];
  for (const file of files) {
    fileResults.push(scoreFileQuiet(file));
  }

  const validResults = fileResults.filter((r) => r.valid);
  const meanPercentage = avg(validResults.map((r) => r.percentage));
  const meanRequired = avg(validResults.map((r) => r.requiredPercentage));
  const allValid = fileResults.every((r) => r.valid) && emptyTargets.length === 0;

  const output: CompletenessJsonOutput = {
    files: fileResults,
    emptyTargets,
    totals: {
      files: files.length,
      meanPercentage,
      meanRequiredPercentage: meanRequired,
      emptyTargets: emptyTargets.length,
    },
    valid: allValid,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!allValid) {
    process.exit(1);
  }
}

function scoreFileQuiet(filePath: string): FileCompletenessResult {
  let data: unknown;
  try {
    data = readJSON(filePath);
  } catch {
    return emptyResult(filePath, 'Failed to parse JSON');
  }

  if (!data || typeof data !== 'object') {
    return emptyResult(filePath, 'Not a valid JSON object');
  }

  const parsed = parseEnrichedObservation(data);
  if (!parsed.success) {
    return emptyResult(filePath, `Invalid observation (${parsed.issues.length} issue${parsed.issues.length !== 1 ? 's' : ''})`);
  }

  const comp = getCompleteness(data as Record<string, unknown>);

  return {
    file: filePath,
    valid: true,
    percentage: comp.percentage,
    requiredPercentage: comp.requiredPercentage,
    present: comp.present,
    total: comp.total,
    missing: comp.missing,
  };
}

function printUsage(): void {
  console.log(heading(`${BRAND} completeness`));
  console.log(`\nMeasure how fully observation JSON files populate the records schema.\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos completeness <path...> [options]\n`);
  console.log(`${dim('Paths:')}`);
  console.log(`  Accepts one or more files, directories, or shell globs.\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --recursive, -r      Score all JSON files in directories recursively`);
  console.log(`  --json, -j           Output results as structured JSON (for CI and scripts)`);
  console.log(`  --help, -h           Show this help message\n`);
  console.log(`${dim('Scoring:')}`);
  console.log(`  Files must be structurally valid observations before completeness is measured.`);
  console.log(`  Invalid JSON or invalid observations exit non-zero without a score.\n`);
  console.log(`${dim('Output:')}`);
  console.log(`  • Completeness percentage (0–100) — how many schema fields are populated`);
  console.log(`  • Required field percentage — coverage of required fields only`);
  console.log(`  • Top missing field paths — the next fields to target\n`);
  console.log(`${dim('Examples:')}`);
  console.log(`  disclosureos completeness ./data/nimitz.json`);
  console.log(`  disclosureos completeness ./data/ --recursive`);
  console.log(`  disclosureos completeness ./out/*.json --json\n`);
}
