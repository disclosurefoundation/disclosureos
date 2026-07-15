// Dependency-free structural validation of every *-sensors.json manifest in
// this directory against the UAP Sensor Manifest schema's core invariants.
// Any org (ELDÆON, Galileo, UFODAP, ...) drops an <org>-sensors.json here and
// this validates it the same way. Run: node validate.mjs
import { readFileSync, readdirSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('./sensor-manifest.schema.json', here)));
const MODALITIES = schema.$defs.Modality.enum;
const CAL_STATUSES = schema.$defs.SensorEntry.properties.calibration.properties.status.enum;

const manifests = readdirSync(here).filter((f) => f.endsWith('-sensors.json'));
if (!manifests.length) { console.error('no *-sensors.json manifests found'); process.exit(1); }

let failed = false;
for (const file of manifests) {
  const data = JSON.parse(readFileSync(new URL(`./${file}`, here)));
  const errors = [];

  for (const key of ['schemaVersion', 'org', 'sensors']) {
    if (!(key in data)) errors.push(`top-level: missing "${key}"`);
  }
  if (!Array.isArray(data.sensors)) errors.push('sensors: not an array');

  const ids = new Set();
  for (const [i, s] of (data.sensors ?? []).entries()) {
    const where = `sensors[${i}] (${s.id ?? '?'})`;
    for (const k of ['id', 'name', 'modality']) if (!s[k]) errors.push(`${where}: missing "${k}"`);
    if (s.modality && !MODALITIES.includes(s.modality)) errors.push(`${where}: bad modality "${s.modality}"`);
    if (s.id && ids.has(s.id)) errors.push(`${where}: duplicate id`);
    ids.add(s.id);
    for (const [j, m] of (s.measurements ?? []).entries()) {
      if (!m.name || !m.unit) errors.push(`${where}.measurements[${j}]: needs name + unit`);
    }
    if (s.calibration?.status && !CAL_STATUSES.includes(s.calibration.status)) {
      errors.push(`${where}: bad calibration.status "${s.calibration.status}"`);
    }
  }

  for (const [i, u] of (data.futureUpgrades ?? []).entries()) {
    const where = `futureUpgrades[${i}] (${u.name ?? '?'})`;
    if (!u.name) errors.push(`${where}: missing "name"`);
    if (!u.modality || !MODALITIES.includes(u.modality)) errors.push(`${where}: bad modality "${u.modality}"`);
  }

  if (errors.length) {
    console.error(`❌ ${file} INVALID:\n` + errors.map((e) => '  - ' + e).join('\n'));
    failed = true;
    continue;
  }

  const byModality = {};
  const proposed = [];
  for (const s of data.sensors) {
    byModality[s.modality] = (byModality[s.modality] ?? 0) + 1;
    if (s.disclosureosMapping?.proposedSensorType) proposed.push(s.disclosureosMapping.sensorType);
  }
  console.log(`✅ ${file} (${data.org}) — ${data.sensors.length} sensors across ${Object.keys(byModality).length} modalities, ${(data.futureUpgrades ?? []).length} future upgrades`);
  console.log('   by modality:', JSON.stringify(byModality));
  console.log(`   P1 proposed new sensorTypes (${proposed.length}):`, proposed.join(', '));
}
process.exit(failed ? 1 : 0);
