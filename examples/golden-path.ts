/**
 * DisclosureOS golden path — one observation through every layer.
 *
 *   Records      → "what was observed"        (createObservation, createSensorReading)
 *   Instruments  → "what hardware produced it" (createSensorManifest → sensorRef)
 *   Observables  → "what anomalies it showed" (createObservableClaim → observableAssessments)
 *   Origins      → "what might explain it"    (createOriginClaim → origin)
 *   Schema       → "is the enriched whole valid, slots intact?" (parseEnrichedObservation)
 *   Scoring      → "how complete / compelling is it?"           (getCompleteness, score)
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
import { getCompleteness, score } from '@disclosureos/scoring';

// 0. Instruments — a published sensor manifest describing the hardware. The
// manifest is a standalone document (published by the operating organization,
// not embedded in a record); readings point at its entries via `sensorRef`.
const spy1Entry = createSensorEntry('princeton-spy1', 'AN/SPY-1B Passive Phased Array Radar', 'radio_frequency', {
  recordsMapping: { sensorType: 'shipborne_radar', detectionMethod: 'radar_phased_array' },
  timing: { timeSource: 'gps_disciplined' },
  calibration: { status: 'documented', currentMethod: 'Navy maintenance and alignment program', referenceInUse: true },
});
const navyManifest = createSensorManifest('US Navy', 'us-navy', [spy1Entry]);
const manifestIssues = validateSensorManifest(navyManifest);
if (manifestIssues.length > 0) {
  console.error('❌ invalid manifest:', manifestIssues);
  process.exit(1);
}

// The in-record sensor reading the claims below cite. `evidenceRef` builds the
// "sensor:<id>" pointer; because this reading is attached to the observation, the
// ref resolves (no dangling-evidence warning from `disclosureos validate`).
// `sensorRef` points the reading at the manifest entry above ("<org-slug>:<sensor-id>").
const radar = createSensorReading('shipborne_radar', 'radar_phased_array', {
  id: 'princeton-spy1-radar',
  platform: 'USS Princeton (CG-59), AN/SPY-1 phased array',
  operator: 'US Navy',
  sensorRef: sensorRef(navyManifest.orgSlug, spy1Entry.id),
});
const RADAR = evidenceRef('sensor', radar.id);

// 1. Records — the core observation (USS Nimitz "Tic Tac", 2004-11-14).
const base = createObservation(
  {
    temporal: { date: '2004-11-14', dateCertainty: 'exact', durationSeconds: 300 },
    location: { name: 'Pacific Ocean, ~100mi SW of San Diego', country: 'United States', latitude: 31.5, longitude: -117.5, siteType: 'ocean' },
    summary: 'Tic-Tac-shaped craft tracked on radar and intercepted by F/A-18 pilots; instantaneous acceleration observed.',
    objectCharacteristics: { shape: 'tic_tac', sizeMeters: 12, color: 'white', numberObserved: 1 },
    witnesses: { count: 4, categories: ['military_pilot', 'radar_operator'], militaryWitnesses: true, multipleIndependent: true },
    sensorEvidence: { sensors: [radar] },
  },
  { id: 'nimitz-tic-tac-2004', status: 'published' },
);

// 2. Observables — anomalous characteristics, as evidence-backed claims.
const observableAssessments: EnrichedObservation['observableAssessments'] = {
  technology: {
    instantaneous_acceleration: [
      createObservableClaim('confirmed', { confidence: 0.85, rationale: 'Radar tracked descent from ~80,000 ft to sea level in seconds.', evidenceRefs: [RADAR] }),
    ],
    transmedium_travel: [
      createObservableClaim('documented', { confidence: 0.6, rationale: 'Subsurface radar returns reported on departure.', evidenceRefs: [RADAR] }),
    ],
  },
};

// 3. Origins — competing explanations (ETH-leaning + prosaic) as a flat list.
const origin: EnrichedObservation['origin'] = [
  createOriginClaim('1.1.3', 0.4, {
    rationale: 'Performance exceeds known aerospace capability; cannot exclude advanced terrestrial program.',
    alternativeHypotheses: [{ nodeId: '1.1.1.2.1', confidence: 0.25, label: 'Classified U.S. program' }],
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

// 5. Scoring — how complete is the record, and how compelling is the case?
const completeness = getCompleteness(observation);
const compellingness = score(observation);

console.log(`✅ ${observation.id} is valid (slots intact).`);
console.log(`   instruments   : ${formatSensorManifest(navyManifest)} — cited via ${radar.sensorRef}`);
console.log(`   completeness  : ${completeness.percentage}% (${completeness.requiredPercentage}% of required fields)`);
console.log(`   compellingness: ${compellingness.score.toFixed(2)} (range ${compellingness.range.low.toFixed(2)}–${compellingness.range.high.toFixed(2)}, contested: ${compellingness.contested})`);
