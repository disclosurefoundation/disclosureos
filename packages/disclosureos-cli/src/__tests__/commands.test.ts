import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeness } from '../commands/completeness';
import { info } from '../commands/info';
import { manifest } from '../commands/manifest';
import { registry } from '../commands/registry';
import { validate } from '../commands/validate';
import { getTemplate } from '../output/templates';
import { parseArgs } from '../utils/args';
import type { ParsedArgs } from '../utils/args';

const tempDirs: string[] = [];
const ANSI_ESCAPE_SEQUENCE = new RegExp('\\u001B\\[[0-?]*[ -/]*[@-~]', 'g');

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'disclosureos-cli-'));
  tempDirs.push(dir);
  return dir;
}

function validateArgs(path: string, flags: ParsedArgs['flags'] = {}): ParsedArgs {
  return {
    command: 'validate',
    subcommand: path,
    positional: [],
    flags,
  };
}

function commandArgs(
  command: string,
  subcommand = '',
  positional: string[] = [],
  flags: ParsedArgs['flags'] = {},
): ParsedArgs {
  return {
    command,
    subcommand,
    positional,
    flags,
  };
}

function captureLog(run: () => void): string {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  run();
  return log.mock.calls.flat().join('\n').replace(ANSI_ESCAPE_SEQUENCE, '');
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('scaffold templates', () => {
  it('emits a valid minimal observation JSON template', () => {
    const template = JSON.parse(getTemplate('observation')) as Record<string, unknown>;

    expect(template['id']).toEqual(expect.any(String));
    expect(template['temporal']).toMatchObject({ date: '2024-01-01', dateCertainty: 'exact' });
    expect(template['location']).toMatchObject({
      id: expect.any(String),
      name: 'Untitled Observation',
      country: 'Unknown',
    });
    expect(template['status']).toBe('draft');
    expect(template['createdAt']).toEqual(expect.any(String));
    expect(template['updatedAt']).toEqual(expect.any(String));
  });

  it('emits claim-list templates for observable assessments', () => {
    const template = JSON.parse(getTemplate('assessment')) as {
      technology: { instantaneous_acceleration: unknown[] };
      biologics: { molecular_complexity: unknown[] };
    };

    expect(Array.isArray(template.technology.instantaneous_acceleration)).toBe(true);
    expect(Array.isArray(template.biologics.molecular_complexity)).toBe(true);
  });
});

describe('validate command', () => {
  it('validates a scaffolded observation file', () => {
    const dir = createTempDir();
    const file = join(dir, 'observation.json');
    writeFileSync(file, getTemplate('observation'));

    const output = captureLog(() => validate(validateArgs(file)));

    expect(output).toContain('All 1 file(s) valid');
  });

  it('warns when claim evidence points at a missing in-record item', () => {
    const dir = createTempDir();
    const file = join(dir, 'dangling-ref.json');
    const observation = JSON.parse(getTemplate('observation')) as Record<string, unknown>;
    observation['observableAssessments'] = {
      technology: {
        instantaneous_acceleration: [
          {
            level: 'reported',
            confidence: 0.5,
            rationale: 'Witness described an abrupt acceleration.',
            evidenceRefs: ['sensor:missing-radar'],
          },
        ],
      },
    };
    writeFileSync(file, JSON.stringify(observation, null, 2));

    const output = captureLog(() => validate(validateArgs(file)));
    expect(output).toContain('dangling evidence ref "sensor:missing-radar"');
    expect(output).toContain('All 1 file(s) valid (1 warning)');
  });

  it('outputs structured JSON with --json flag for a valid file', () => {
    const dir = createTempDir();
    const file = join(dir, 'observation.json');
    writeFileSync(file, getTemplate('observation'));

    const output = captureLog(() => validate(validateArgs(file, { json: true })));
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(true);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].valid).toBe(true);
    expect(parsed.files[0].errors).toHaveLength(0);
    expect(parsed.totals.files).toBe(1);
    expect(parsed.totals.errors).toBe(0);
  });

  it('outputs structured JSON with errors for an invalid file', () => {
    const dir = createTempDir();
    const file = join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify({ not: 'an observation' }));

    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const output = captureLog(() => validate(validateArgs(file, { json: true })));
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(false);
    expect(parsed.files[0].valid).toBe(false);
    expect(parsed.files[0].errors.length).toBeGreaterThan(0);
    expect(parsed.totals.errors).toBeGreaterThan(0);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('includes warnings in JSON output for dangling evidence refs', () => {
    const dir = createTempDir();
    const file = join(dir, 'dangling.json');
    const observation = JSON.parse(getTemplate('observation')) as Record<string, unknown>;
    observation['observableAssessments'] = {
      technology: {
        instantaneous_acceleration: [
          {
            level: 'reported',
            confidence: 0.5,
            rationale: 'Test.',
            evidenceRefs: ['sensor:missing-radar'],
          },
        ],
      },
    };
    writeFileSync(file, JSON.stringify(observation, null, 2));

    const output = captureLog(() => validate(validateArgs(file, { json: true })));
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(true);
    expect(parsed.files[0].warnings.length).toBeGreaterThan(0);
    expect(parsed.files[0].warnings[0].message).toContain('dangling evidence ref');
    expect(parsed.totals.warnings).toBeGreaterThan(0);
  });

  it('reports empty targets in JSON output', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const output = captureLog(() =>
      validate(validateArgs('/nonexistent/path', { json: true })),
    );
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(false);
    expect(parsed.emptyTargets).toContain('/nonexistent/path');
    expect(parsed.totals.emptyTargets).toBe(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('manifest command', () => {
  const validManifest = {
    schemaVersion: '1.0.0',
    org: 'ELDÆON',
    orgSlug: 'eldaeon',
    sensors: [
      {
        id: 'dionysus-passive-radar',
        name: 'Passive Bistatic Radar',
        modality: 'radio_frequency',
        recordsMapping: { sensorType: 'passive_radar', detectionMethod: 'radio_frequency' },
        timing: { timeSource: 'gps_disciplined', timeUncertaintyNs: null },
        calibration: { status: 'in_practice', traceableReference: 'ADS-B Exchange', referenceInUse: true },
      },
    ],
    futureUpgrades: [{ name: 'Microbarometer', modality: 'audio', status: 'planned' }],
  };

  it('validates a valid sensor manifest', () => {
    const dir = createTempDir();
    const file = join(dir, 'eldaeon-sensors.json');
    writeFileSync(file, JSON.stringify(validManifest, null, 2));

    const output = captureLog(() => manifest(commandArgs('manifest', 'validate', [file])));

    expect(output).toContain('All 1 manifest(s) valid');
    expect(output).toContain('ELDÆON (eldaeon) — 1 sensors, 1 future upgrades');
  });

  it('rejects an unflagged mapping value outside the records enums', () => {
    const dir = createTempDir();
    const file = join(dir, 'bad-sensors.json');
    const bad = structuredClone(validManifest);
    bad.sensors[0]!.recordsMapping = { sensorType: 'crystal_ball', detectionMethod: 'radio_frequency' };
    writeFileSync(file, JSON.stringify(bad, null, 2));

    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const output = captureLog(() => manifest(commandArgs('manifest', 'validate', [file])));

    expect(output).toContain('not a records SensorType');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('reports proposed values in --json mode', () => {
    const dir = createTempDir();
    const file = join(dir, 'proposed-sensors.json');
    const proposed = structuredClone(validManifest);
    proposed.sensors[0]!.recordsMapping = {
      sensorType: 'tachyon_array',
      detectionMethod: 'radio_frequency',
      proposedSensorType: true,
    } as never;
    writeFileSync(file, JSON.stringify(proposed, null, 2));

    const output = captureLog(() => manifest(commandArgs('manifest', 'validate', [file], { json: true })));
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(true);
    expect(parsed.files[0].summary.proposedSensorTypes).toEqual(['tachyon_array']);
    expect(parsed.files[0].summary.byModality).toEqual({ radio_frequency: 1 });
  });
});

describe('completeness command', () => {
  it('scores a valid scaffold observation and reports percentage', () => {
    const dir = createTempDir();
    const file = join(dir, 'observation.json');
    writeFileSync(file, getTemplate('observation'));

    const output = captureLog(() => completeness(validateArgs(file)));

    expect(output).toContain('Completeness:');
    expect(output).toContain('Required:');
    expect(output).toContain('1 file(s) scored');
  });

  it('outputs structured JSON with --json flag', () => {
    const dir = createTempDir();
    const file = join(dir, 'observation.json');
    writeFileSync(file, getTemplate('observation'));

    const output = captureLog(() => completeness(validateArgs(file, { json: true })));
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(true);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].valid).toBe(true);
    expect(typeof parsed.files[0].percentage).toBe('number');
    expect(typeof parsed.files[0].requiredPercentage).toBe('number');
    expect(Array.isArray(parsed.files[0].missing)).toBe(true);
    expect(typeof parsed.totals.meanPercentage).toBe('number');
  });

  it('exits non-zero for invalid observation', () => {
    const dir = createTempDir();
    const file = join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify({ not: 'an observation' }));

    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    captureLog(() => completeness(validateArgs(file)));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('reports empty targets in JSON output', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const output = captureLog(() =>
      completeness(validateArgs('/nonexistent/path', { json: true })),
    );
    const parsed = JSON.parse(output);

    expect(parsed.valid).toBe(false);
    expect(parsed.emptyTargets).toContain('/nonexistent/path');
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('registry command', () => {
  it('lists schema-derived fields for a selected category', () => {
    const output = captureLog(() =>
      registry(commandArgs('registry', 'fields', [], { category: 'temporal' })),
    );

    expect(output).toContain('Observation Field Registry');
    expect(output).toContain('Group: temporal');
    expect(output).toContain('temporal.date');
    expect(output).toContain('required');
  });

  it('lists technology observables without biologics when filtered', () => {
    const output = captureLog(() =>
      registry(commandArgs('registry', 'observables', [], { technology: true })),
    );

    expect(output).toContain('Observable Registry');
    expect(output).toContain('Technology Observables');
    expect(output).toContain('TO-2');
    expect(output).not.toContain('Biologics Observables');
  });

  it('shows origin node details and children', () => {
    const output = captureLog(() => registry(commandArgs('registry', 'origins', [], { id: '1.1.3' })));

    expect(output).toContain('Origin Classification System');
    expect(output).toContain('ID');
    expect(output).toContain('1.1.3');
    expect(output).toContain('Extraterrestrial');
    expect(output).toContain('Testable');
  });

  it('lists scientifically testable origin hypotheses', () => {
    const output = captureLog(() => registry(commandArgs('registry', 'origins', [], { testable: true })));

    expect(output).toContain('Scientifically Testable Hypotheses');
    expect(output).toContain('[1.1.3]');
  });
});

describe('info command', () => {
  it('prints the ecosystem overview by default', () => {
    const output = captureLog(() => info(commandArgs('info')));

    expect(output).toContain('DisclosureOS Ecosystem');
    expect(output).toContain('@disclosureos/records');
    expect(output).toContain('@disclosureos/cli');
  });

  it('prints observation type summary', () => {
    const output = captureLog(() => info(commandArgs('info', 'observation')));

    expect(output).toContain('Observation Type');
    expect(output).toContain('Required Fields');
    expect(output).toContain('observableAssessments');
    expect(output).toContain('origin');
  });

  it('prints observable details by code', () => {
    const output = captureLog(() => info(commandArgs('info', 'observable', ['TO-2'])));

    expect(output).toContain('Observable: Instantaneous Acceleration');
    expect(output).toContain('TO-2');
    expect(output).toContain('Assessment Levels');
  });

  it('prints origin node details by id', () => {
    const output = captureLog(() => info(commandArgs('info', 'origin', ['1.1.3'])));

    expect(output).toContain('Origin: Extraterrestrial');
    expect(output).toContain('Path:');
    expect(output).toContain('Physical');
  });
});

describe('argument parsing', () => {
  it('does not let boolean flags consume following positional paths', () => {
    const parsed = parseArgs(['node', 'disclosureos', 'validate', '--recursive', './data']);

    expect(parsed).toMatchObject({
      command: 'validate',
      subcommand: './data',
      flags: { recursive: true },
    });
  });

  it('does let value flags consume their value', () => {
    const parsed = parseArgs(['node', 'disclosureos', 'registry', 'origins', '--id', '1.1.3']);

    expect(parsed).toMatchObject({
      command: 'registry',
      subcommand: 'origins',
      flags: { id: '1.1.3' },
    });
  });
});
