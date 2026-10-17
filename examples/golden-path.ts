/**
 * DisclosureOS golden path — one fictional observation through every layer.
 * This is synthetic teaching data, not a historical case or a retained sensor recording.
 *
 *   Records      → "what was observed"        (createObservation, createSensorReading)
 *   Instruments  → "what hardware produced it" (createSensorManifest → sensorRef)
 *   Observables  → "which characteristics were described" (createObservableClaim → observableAssessments)
 *   Origins      → "what might explain it"    (createOriginClaim → origin)
 *   Schema       → "is the enriched whole valid, slots intact?" (parseEnrichedObservation)
 *   Scoring      → "how complete / compelling is it?"           (getCompleteness)
 *
 * Run it:  pnpm --filter @disclosureos/examples golden-path
 *
 * Importing `@disclosureos/schema` registers the satellite slots, so the
 * `observableAssessments` and `origin` fields below are typed on `Observation`.
 */
import { createObservation, createSensorReading } from '@disclosureos/records/factories';
import { evidenceRef, sensorRef } from '@disclosureos/records/shared';
import { createSensorEntry, createSensorManifest, validateSensorManifest, formatSensorManifest } from '@disclosureos/instruments';
import { createObservableClaim } from '@disclosureos/observables';
import { createOriginClaim } from '@disclosureos/origins';
import { parseEnrichedObservation, type EnrichedObservation } from '@disclosureos/schema';
import { getCompleteness } from '@disclosureos/scoring';

// 0. Instruments — a published sensor manifest describing the hardware. The
// manifest is a standalone document (published by the operating organization,
// not embedded in a record); readings point at its entries via `sensorRef`.
const radarEntry = createSensorEntry('training-radar', 'Fictional shipborne training radar', 'radio_frequency', {
  recordsMapping: { sensorType: 'shipborne_radar', detectionMethod: 'radar_phased_array' },
  timing: { timeSource: 'gps_disciplined' },
  calibration: { status: 'documented', currentMethod: 'Synthetic alignment procedure; no operational calibration asserted', referenceInUse: true },
});
const exampleManifest = createSensorManifest('DisclosureOS example operator', 'example-operator', [radarEntry]);
const manifestIssues = validateSensorManifest(exampleManifest);
if (manifestIssues.length > 0) {
  console.error('❌ invalid manifest:', manifestIssues);
  process.exit(1);
}

// The in-record sensor reading the claims below cite. `evidenceRef` builds the
// "sensor:<id>" pointer; because this reading is attached to the observation, the
// ref resolves (no dangling-evidence warning from `disclosureos validate`).
// `sensorRef` points the reading at the manifest entry above ("<org-slug>:<sensor-id>").
const radar = createSensorReading('shipborne_radar', 'radar_phased_array', {
  id: 'training-radar-reading',
  platform: 'Fictional coastal survey vessel',
  operator: 'DisclosureOS example operator',
  sensorRef: sensorRef(exampleManifest.orgSlug, radarEntry.id),
});
const RADAR = evidenceRef('sensor', radar.id);

// 1. Records — a fictional teaching observation. Coordinates and timings are illustrative.
const base = createObservation(
  {
    temporal: { date: '2026-10-13', dateCertainty: 'exact', durationSeconds: 300 },
    location: { name: 'Fictional offshore training area', country: 'United States', latitude: 31.5, longitude: -117.5, siteType: 'ocean' },
    summary: 'Synthetic operators report an apparent change in a radar track. Physical acceleration and object identity are unresolved.',
    objectCharacteristics: { numberObserved: 1 },
    witnesses: { count: 2, categories: ['radar_operator'], multipleIndependent: false },
    sensorEvidence: { sensors: [radar] },
  },
  { id: 'fictional-radar-example', status: 'published' },
);

// 2. Observables — attributed descriptions. A sensor reference identifies a source;
// it does not by itself establish a measured acceleration or anomaly.
const observableAssessments: EnrichedObservation['observableAssessments'] = {
  technology: {
    abrupt_motion: [
      createObservableClaim('reported', { evaluatedBy: 'Example reviewer', rationale: 'The synthetic operator report describes a sudden change in a track; range geometry and association are unresolved.', evidenceRefs: [RADAR] }),
    ],
    sensor_detection_discrepancy: [
      createObservableClaim('reported', { evaluatedBy: 'Example reviewer', rationale: 'The synthetic report describes an interruption in tracking. No cause or target behavior is established.', evidenceRefs: [RADAR] }),
    ],
  },
};

// 3. Origins — an attributed hypothesis, separate from the described characteristics.
const origin: EnrichedObservation['origin'] = [
  createOriginClaim('1.1.1.2.1', 0.4, {
    evaluatedBy: 'Example reviewer',
    rationale: 'A conventional aircraft is one synthetic hypothesis; the limited report does not establish an identification.',
    evidenceRefs: [RADAR],
  }),
];

const observation: EnrichedObservation = { ...base, observableAssessments, origin };

// 4. Schema — validate core + slots in ONE call, WITHOUT stripping the slots.
const parsed = parseEnrichedObservation(observation);
if (!parsed.success) {
  console.error('❌ invalid:', parsed.issues);
  process.exit(1);
}

// 5. Population coverage counts retained fields. It does not certify quality.
// Do not call score(observation): descriptive observable support cannot be
// converted into anomaly strength. V2 research results use attributed assessments
// and profile evaluation rather than an automatic anomaly score.
const completeness = getCompleteness(observation);

console.log(`✅ ${observation.id} is valid (slots intact).`);
console.log(`   instruments   : ${formatSensorManifest(exampleManifest)} — cited via ${radar.sensorRef}`);
console.log(`   field coverage: ${completeness.percentage}% (${completeness.requiredPercentage}% of required fields)`);
console.log('   anomaly score : not computed from descriptive characteristics');
