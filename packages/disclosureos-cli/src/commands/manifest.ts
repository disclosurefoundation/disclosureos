import type { ParsedArgs } from '../utils/args';
import { readJSON, findJSONFiles } from '../utils/fs';
import { heading, success, error, dim, BRAND } from '../output/format';
import { validateSensorManifest, formatSensorManifest } from '@disclosureos/instruments';
import type { SensorManifest } from '@disclosureos/instruments';

/** Structured result for a single manifest file, emitted in --json mode. */
export interface ManifestFileResult {
  file: string;
  valid: boolean;
  errors: { path: string; message: string }[];
  summary?: {
    org: string;
    orgSlug: string;
    sensors: number;
    byModality: Record<string, number>;
    proposedSensorTypes: string[];
    proposedDetectionMethods: string[];
    futureUpgrades: number;
  };
}

export function manifest(args: ParsedArgs): void {
  if (args.flags['help'] || args.subcommand !== 'validate') {
    printUsage();
    if (!args.flags['help'] && args.subcommand !== undefined && args.subcommand !== 'validate') {
      process.exit(1);
    }
    return;
  }

  const targets = args.positional.filter((t): t is string => !!t);
  if (targets.length === 0) {
    printUsage();
    return;
  }

  const recursive = !!args.flags['recursive'];
  const jsonMode = !!args.flags['json'];

  const files = [...new Set(targets.flatMap((target) => findJSONFiles(target, recursive)))];
  if (files.length === 0) {
    console.log(error(`No JSON files found at: ${targets.join(', ')}`));
    process.exit(1);
  }

  const results = files.map(validateManifestFile);

  if (jsonMode) {
    const valid = results.every((result) => result.valid);
    console.log(JSON.stringify({ files: results, valid }, null, 2));
    if (!valid) process.exit(1);
    return;
  }

  let failed = false;
  for (const result of results) {
    if (!result.valid) {
      failed = true;
      console.log(`\n${error(`${result.file} INVALID`)}`);
      for (const issue of result.errors) {
        console.log(`  ${error(`${issue.path}: ${issue.message}`)}`);
      }
      continue;
    }

    const summary = result.summary!;
    console.log(`\n${success(`${result.file}`)}`);
    console.log(`  ${dim(formatManifestLine(summary))}`);
    console.log(`  ${dim('by modality:')} ${Object.entries(summary.byModality).map(([m, n]) => `${m} ${n}`).join(', ')}`);
    if (summary.proposedSensorTypes.length > 0) {
      console.log(`  ${dim(`proposed sensor types (${summary.proposedSensorTypes.length}):`)} ${summary.proposedSensorTypes.join(', ')}`);
    }
    if (summary.proposedDetectionMethods.length > 0) {
      console.log(`  ${dim(`proposed detection methods (${summary.proposedDetectionMethods.length}):`)} ${summary.proposedDetectionMethods.join(', ')}`);
    }
  }

  console.log('');
  if (failed) {
    console.log(error(`Validation failed`));
    process.exit(1);
  }
  console.log(success(`All ${files.length} manifest(s) valid`));
}

function formatManifestLine(summary: NonNullable<ManifestFileResult['summary']>): string {
  return `${summary.org} (${summary.orgSlug}) — ${summary.sensors} sensors, ${summary.futureUpgrades} future upgrades`;
}

function validateManifestFile(file: string): ManifestFileResult {
  let data: unknown;
  try {
    data = readJSON(file);
  } catch {
    return { file, valid: false, errors: [{ path: '', message: 'Failed to parse JSON' }] };
  }

  const issues = validateSensorManifest(data);
  if (issues.length > 0) {
    return { file, valid: false, errors: issues };
  }

  const parsed = data as SensorManifest;
  const byModality: Record<string, number> = {};
  const proposedSensorTypes: string[] = [];
  const proposedDetectionMethods: string[] = [];
  for (const sensor of parsed.sensors) {
    byModality[sensor.modality] = (byModality[sensor.modality] ?? 0) + 1;
    if (sensor.recordsMapping?.proposedSensorType && sensor.recordsMapping.sensorType) {
      proposedSensorTypes.push(sensor.recordsMapping.sensorType);
    }
    if (sensor.recordsMapping?.proposedDetectionMethod && sensor.recordsMapping.detectionMethod) {
      proposedDetectionMethods.push(sensor.recordsMapping.detectionMethod);
    }
  }

  return {
    file,
    valid: true,
    errors: [],
    summary: {
      org: parsed.org,
      orgSlug: parsed.orgSlug,
      sensors: parsed.sensors.length,
      byModality,
      proposedSensorTypes,
      proposedDetectionMethods,
      futureUpgrades: parsed.futureUpgrades?.length ?? 0,
    },
  };
}

function printUsage(): void {
  console.log(heading(`${BRAND} manifest`));
  console.log(`\nValidate sensor-manifest JSON files (@disclosureos/instruments).\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos manifest validate <path...> [options]\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --recursive, -r      Validate all JSON files in directories recursively`);
  console.log(`  --json, -j           Output results as structured JSON (for CI and scripts)`);
  console.log(`  --help, -h           Show this help message\n`);
  console.log(`${dim('Validation checks:')}`);
  console.log(`  • Manifest structure (org, orgSlug, sensors, calibration, timing, measurements)`);
  console.log(`  • Sensor ids unique and kebab-case`);
  console.log(`  • recordsMapping values exist in the records enums or carry proposed* flags\n`);
  console.log(`${dim('Examples:')}`);
  console.log(`  disclosureos manifest validate ./manifests/eldaeon-sensors.json`);
  console.log(`  disclosureos manifest validate ./manifests/ --recursive --json\n`);
}
