export type TemplateName = 'observation' | 'observation-full' | 'assessment' | 'classification';

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function buildObservation(full: boolean): Record<string, unknown> {
  const now = new Date().toISOString();

  const minimal: Record<string, unknown> = {
    id: uuid(),
    temporal: {
      date: '2024-01-01',
      dateCertainty: 'exact',
      timeOfDay: 'night',
    },
    location: {
      id: uuid(),
      name: 'Untitled Observation',
      country: 'Unknown',
      latitude: 0,
      longitude: 0,
      siteType: 'unknown',
      terrain: 'unknown',
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    summary: '',
  };

  if (!full) return minimal;

  return {
    ...minimal,
    temporal: {
      date: '2024-01-01',
      dateCertainty: 'exact',
      timeOfDay: 'night',
      durationSeconds: 0,
    },
    location: {
      id: uuid(),
      name: 'Untitled Observation',
      country: 'Unknown',
      latitude: 0,
      longitude: 0,
      siteType: 'unknown',
      terrain: 'unknown',
      elevationMeters: 0,
      coordinatesApproximate: false,
      locationSensitivity: 'none',
    },
    description: '',
    objectCharacteristics: {
      shape: 'unknown',
      color: '',
      size: '',
      luminosity: '',
      sound: '',
      numberObserved: 1,
    },
    eventType: '',
    sourceData: { sources: [] },
    investigation: {
      investigatingBody: '',
      caseNumber: '',
      conclusion: '',
      confidence: 'unassessed',
    },
    movement: { speed: '', maneuvers: [] },
    witnesses: { count: 0, categories: [] },
    sensorEvidence: { sensors: [], multiSensorCorrelation: false },
    environment: { weather: '', visibility: '' },
    media: [],
    relations: { edges: [] },
    dataSourceId: '',
    schemaVersion: '1.0.0',
  };
}

// Each observable maps to a *list* of claims (competing verdicts coexist).
// `evidenceRefs` point at in-record evidence ("media:<id>", "sensor:<id>", …).
const ASSESSMENT_TEMPLATE = {
  technology: {
    antigravity_lift: [
      { level: 'not_indicated', rationale: '', evidenceRefs: [] },
    ],
    instantaneous_acceleration: [{ level: 'not_indicated', rationale: '' }],
    hypersonic_no_signatures: [{ level: 'not_indicated', rationale: '' }],
    low_observability: [{ level: 'not_indicated', rationale: '' }],
    transmedium_travel: [{ level: 'not_indicated', rationale: '' }],
    biological_effects: [{ level: 'not_indicated', rationale: '' }],
  },
  biologics: {
    molecular_complexity: [{ level: 'not_indicated', rationale: '' }],
    isotopic_provenance: [{ level: 'not_indicated', rationale: '' }],
    non_standard_biochemistry: [{ level: 'not_indicated', rationale: '' }],
    non_phylogenetic_genetics: [{ level: 'not_indicated', rationale: '' }],
    anomalous_morphology: [{ level: 'not_indicated', rationale: '' }],
    anomalous_bio_interaction: [{ level: 'not_indicated', rationale: '' }],
  },
};

// The `origin` slot is a *list* of competing classifications (one per evaluator).
const CLASSIFICATION_TEMPLATE = [
  {
    primaryHypothesis: '1.1.1',
    confidence: 0.5,
    alternativeHypotheses: [{ nodeId: '1.1.3', confidence: 0.2 }],
    rationale: '',
    evaluatedBy: '',
    evidenceRefs: [],
  },
];

export function getTemplate(name: TemplateName): string {
  const data: unknown =
    name === 'observation'
      ? buildObservation(false)
      : name === 'observation-full'
        ? buildObservation(true)
        : name === 'assessment'
          ? ASSESSMENT_TEMPLATE
          : CLASSIFICATION_TEMPLATE;
  return JSON.stringify(data, null, 2);
}
