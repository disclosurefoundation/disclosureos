import type { ParsedArgs } from '../utils/args';
import { getTemplate, type TemplateName } from '../output/templates';
import { writeOutput } from '../utils/fs';
import { heading, success, error, dim, BRAND } from '../output/format';

const VALID_TEMPLATES: TemplateName[] = ['observation', 'observation-full', 'assessment', 'classification'];

export function scaffold(args: ParsedArgs): void {
  if (args.flags['help']) {
    printUsage();
    return;
  }

  const templateName = resolveTemplateName(args);
  if (!templateName) {
    printUsage();
    return;
  }

  const asTypeScript = !!args.flags['ts'];
  const content = asTypeScript ? getTypeScriptTemplate(templateName) : getTemplate(templateName);
  const outputPath = args.flags['out'] as string | undefined;

  if (outputPath && typeof outputPath === 'string') {
    writeOutput(outputPath, content);
    console.log(success(`Wrote ${templateName} template to ${outputPath}`));
  } else {
    console.log(content);
  }
}

function resolveTemplateName(args: ParsedArgs): TemplateName | null {
  const sub = args.subcommand;
  if (!sub) return null;

  if (sub === 'observation') {
    return args.flags['full'] ? 'observation-full' : 'observation';
  }

  if (VALID_TEMPLATES.includes(sub as TemplateName)) {
    return sub as TemplateName;
  }

  console.log(error(`Unknown template: "${sub}"`));
  return null;
}

function getTypeScriptTemplate(name: TemplateName): string {
  switch (name) {
    case 'observation':
      return TS_OBSERVATION;
    case 'observation-full':
      return TS_OBSERVATION_FULL;
    case 'assessment':
      return TS_ASSESSMENT;
    case 'classification':
      return TS_CLASSIFICATION;
  }
}

const TS_OBSERVATION = `import { createObservation } from '@disclosureos/records/factories';

// createObservation auto-generates id, location.id, and timestamps.
export const observation = createObservation(
  {
    temporal: {
      date: '2024-01-01',
      dateCertainty: 'exact',
      timeOfDay: 'night',
    },
    location: {
      name: '',
      country: '',
      latitude: 0,
      longitude: 0,
      siteType: 'unknown',
    },
    summary: '',
  },
  { status: 'draft' },
);
`;

const TS_OBSERVATION_FULL = `import { createObservation } from '@disclosureos/records/factories';

// createObservation auto-generates id, location.id, and timestamps.
export const observation = createObservation(
  {
    temporal: {
      date: '2024-01-01',
      dateCertainty: 'exact',
      timeOfDay: 'night',
      durationSeconds: 0,
    },
    location: {
      name: '',
      country: '',
      latitude: 0,
      longitude: 0,
      siteType: 'unknown',
      terrain: 'unknown',
    },
    summary: '',
    description: '',
    objectCharacteristics: {
      shape: 'unknown',
      color: '',
      numberObserved: 1,
    },
    eventType: '',
    sourceData: { sources: [] },
    investigation: {
      investigatingBody: '',
      conclusion: '',
      confidence: 'unassessed',
    },
    movement: { maneuvers: [] },
    witnesses: { count: 0, categories: [] },
    sensorEvidence: { sensors: [], multiSensorCorrelation: false },
    environment: { weather: '', visibility: '' },
    media: [],
    schemaVersion: '1.0.0',
  },
  { status: 'draft' },
);
`;

const TS_ASSESSMENT = `import type { ObservableAssessmentMap } from '@disclosureos/observables';
import { createObservableClaim } from '@disclosureos/observables';

// Each observable maps to a *list* of claims, so competing verdicts coexist.
// Pass evidenceRefs (e.g. ['sensor:<id>']) to link a claim to in-record evidence.
export const assessment: ObservableAssessmentMap = {
  technology: {
    apparent_hover: [createObservableClaim('not_indicated')],
    abrupt_motion: [createObservableClaim('not_indicated')],
    hypersonic_signature_discrepancy: [createObservableClaim('not_indicated')],
    sensor_detection_discrepancy: [createObservableClaim('not_indicated')],
    apparent_medium_transition: [createObservableClaim('not_indicated')],
    event_associated_biological_changes: [createObservableClaim('not_indicated')],
  },
  biologics: {
    molecular_complexity_pattern: [createObservableClaim('not_indicated')],
    isotope_ratio_departure: [createObservableClaim('not_indicated')],
    molecular_composition_difference: [createObservableClaim('not_indicated')],
    unresolved_sequence_relationship: [createObservableClaim('not_indicated')],
    unresolved_morphological_characteristics: [createObservableClaim('not_indicated')],
    reported_biological_interaction: [createObservableClaim('not_indicated')],
  },
};
`;

const TS_CLASSIFICATION = `import { createOriginClaim } from '@disclosureos/origins';
import type { OriginClassificationSlot } from '@disclosureos/origins';

// The origin slot is a *list* of competing classifications (one per evaluator).
// Replace '1.1.1' with your primary OCS node ID; createOriginClaim validates
// node IDs and confidence at runtime.
export const classification: OriginClassificationSlot = [
  createOriginClaim('1.1.1', 0.5, {
    alternativeHypotheses: [{ nodeId: '1.1.3', confidence: 0.2 }],
    rationale: '',
  }),
];
`;

function printUsage(): void {
  console.log(heading(`${BRAND} scaffold`));
  console.log(`\nGenerate typed templates for DisclosureOS data structures.\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos scaffold <template> [options]\n`);
  console.log(`${dim('Templates:')}`);
  console.log(`  observation          Minimal Observation (required fields only)`);
  console.log(`  observation --full   Complete Observation with all optional fields`);
  console.log(`  assessment           Observable assessment map (tech + biologics)`);
  console.log(`  classification       Origin classification assignment\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --out, -o <path>     Write to file instead of stdout`);
  console.log(`  --ts                 Output as TypeScript (with typed imports)`);
  console.log(`  --help, -h           Show this help message\n`);
}
