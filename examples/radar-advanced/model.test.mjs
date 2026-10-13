import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import {
  scenarioConfigs,
  simulate,
  beamSchedule,
  synthesizeMilitary,
  detectMilitary,
  trackMilitary,
  simulateMilitary,
  synthesizeSecondary,
  deriveSecondaryReports,
  simulateSecondary,
  secondaryTruthAt,
} from "./model.mjs";
import { createPacket } from "./build.mjs";
const near = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
for (const scenario of ["military", "secondary"]) {
  test(`${scenario}: every retained byte reproduces and every source fingerprint matches`, async () => {
    const a = await createPacket(scenario),
      b = await createPacket(scenario);
    for (const [name, bytes] of a.files)
      assert.deepEqual(bytes, b.files.get(name), name);
    assert.equal(Object.keys(a.index.sources).length, a.files.size - 1);
    for (const [name, source] of Object.entries(a.index.sources)) {
      assert.equal(a.files.get(name).length, source.byteLength);
      assert.equal(
        createHash("sha256").update(a.files.get(name)).digest("hex"),
        source.sha256
      );
    }
    for (const [role, source] of Object.entries(a.index.files)) {
      const layout = a.selection.layouts.find(
        (l) => l.productRef === a.profile.products[role]
      );
      // Full-state diagnostics are retained source products outside the display profile.
      if (!layout) {
        assert.equal(role, "track-state");
        continue;
      }
      assert.equal(layout.byteLength, source.byteLength);
      assert.equal(layout.digest.value, source.sha256);
    }
  });
  test(`${scenario}: downloaded model executes independently of repository files`, async () => {
    const p = await createPacket(scenario),
      directory = await mkdtemp(path.join(tmpdir(), "advanced-radar-"));
    try {
      for (const file of ["model.mjs", "radar-scanning-model.mjs"])
        await writeFile(path.join(directory, file), p.files.get(file));
      const downloaded = await import(
        pathToFileURL(path.join(directory, "model.mjs")).href
      );
      assert.deepEqual(
        downloaded.simulate(downloaded.scenarioConfigs[scenario]),
        simulate(scenarioConfigs[scenario])
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
const c = scenarioConfigs.military,
  m = simulateMilitary(c);
test("military: nonuniform dwell schedule preserves beam order and exact durations", () => {
  assert.equal(m.schedule.length, 256);
  near(m.schedule.at(-1).end_s, 30.72);
  const widths = new Set();
  m.schedule.forEach((d, i) => {
    assert.equal(d.dwell_index, i);
    assert.equal(d.cycle_index, Math.floor(i / 16));
    near(d.end_s - d.start_s, d.purpose === "search" ? 0.1 : 0.18);
    if (i) near(d.start_s, m.schedule[i - 1].end_s);
    widths.add(d.purpose);
    assert.ok(d.beam_azimuth_deg >= 0 && d.beam_azimuth_deg < 360);
  });
  assert.deepEqual([...widths].sort(), ["revisit", "search"]);
  assert.deepEqual(beamSchedule({ ...c, seed: c.seed + 1 }), m.schedule);
});
test("military: power is deterministic but independently varies with source noise", () => {
  const other = synthesizeMilitary({ ...c, seed: c.seed + 1 });
  assert.notDeepEqual(other.returns, m.returns);
  assert.deepEqual(other.schedule, m.schedule);
  assert.deepEqual(other.truth, m.truth);
  for (const power of m.returns)
    assert.ok(Number.isFinite(power) && power >= 0);
});
test("military: detector coordinates are retained beam/range cell centers, not scenario positions", () => {
  for (const d of m.detections) {
    const s = m.schedule[d.dwell_index],
      range = c.rangeOriginM + d.range_index * c.rangeStepM,
      bearing = (s.beam_azimuth_deg * Math.PI) / 180;
    near(d.east_m, range * Math.sin(bearing));
    near(d.north_m, range * Math.cos(bearing));
    near(d.time_s, (s.start_s + s.end_s) / 2);
    assert.equal(
      d.power,
      m.returns[d.dwell_index * c.rangeBins + d.range_index]
    );
    assert.ok(
      d.power >= m.thresholds[d.dwell_index * c.rangeBins + d.range_index]
    );
  }
});
test("military: thresholds independently reproduce retained range-neighborhood values", () => {
  for (const [dwell, bin] of [
    [0, 0],
    [3, 25],
    [101, 43],
    [255, 63],
  ]) {
    let total = 0,
      count = 0;
    for (let delta = -10; delta <= 10; delta++)
      if (
        Math.abs(delta) > 2 &&
        bin + delta >= 0 &&
        bin + delta < c.rangeBins
      ) {
        total += m.returns[dwell * c.rangeBins + bin + delta];
        count++;
      }
    assert.equal(
      m.thresholds[dwell * c.rangeBins + bin],
      Math.fround(Math.max(0.6, (4 * total) / count))
    );
  }
});
test("military: independently pointed adjacent dwells do not suppress one another", () => {
  const schedule = m.schedule.slice(0, 2),
    powers = new Float32Array(2 * c.rangeBins);
  powers[20] = 2;
  powers[c.rangeBins + 20] = 3;
  const result = detectMilitary(powers, schedule, c);
  assert.equal(result.detections.length, 2);
  assert.deepEqual(
    result.detections.map((d) => d.dwell_index),
    [0, 1]
  );
});
test("military: decoder and tracker require no truth, scene labels or target velocities", () => {
  const protectedConfig = {
    ...c,
    get truth() {
      throw Error("Oracle read");
    },
    get targets() {
      throw Error("Oracle read");
    },
  };
  const decoded = detectMilitary(m.returns, m.schedule, protectedConfig);
  assert.deepEqual(decoded.detections, m.detections);
  assert.deepEqual(
    trackMilitary(decoded.detections, m.schedule, protectedConfig).tracks,
    m.tracks
  );
});
test("military: estimates are causal and unavailable future detections cannot change earlier states", () => {
  const prefix = 71,
    earlier = m.schedule.slice(0, prefix);
  const tracks = trackMilitary(
    m.detections.filter((d) => d.dwell_index < prefix),
    earlier,
    c
  ).tracks;
  assert.deepEqual(
    tracks,
    m.tracks.filter((t) => t.dwell_index < prefix)
  );
  const changed = m.returns.slice();
  changed.fill(100, prefix * c.rangeBins);
  assert.deepEqual(
    detectMilitary(changed, m.schedule, c).detections.filter(
      (d) => d.dwell_index < prefix
    ),
    m.detections.filter((d) => d.dwell_index < prefix)
  );
});
test("military: each track update has one prior measured detection and finite covariance", () => {
  const updates = new Set();
  for (const a of m.associations) {
    const key = `${a.track_id}:${a.dwell_index}`;
    assert.ok(!updates.has(key));
    updates.add(key);
    const d = m.detections.find((d) => d.detection_id === a.detection_id);
    assert.equal(d.dwell_index, a.dwell_index);
  }
  for (const t of m.tracks) {
    near(t.time_s, m.schedule[t.dwell_index].end_s);
    assert.ok(
      t.cov_ee_m2 >= 0 &&
        t.cov_nn_m2 >= 0 &&
        t.cov_ee_m2 * t.cov_nn_m2 - t.cov_en_m2 ** 2 >= -1e-6
    );
    assert.equal(
      t.state === "coasting",
      !updates.has(`${t.track_id}:${t.dwell_index}`)
    );
  }
});
test("military: prescribed fading causes real prediction intervals then recovery", () => {
  const first = m.detections.find((d) => d.east_m > 0),
    id = m.associations.find(
      (a) => a.detection_id === first.detection_id
    ).track_id;
  const rows = m.tracks.filter((t) => t.track_id === id);
  const fading = rows.filter(
    (t) =>
      m.schedule[t.dwell_index].cycle_index >= 6 &&
      m.schedule[t.dwell_index].cycle_index <= 8
  );
  assert.ok(fading.length > 0);
  assert.ok(fading.every((t) => t.state === "coasting"));
  assert.ok(fading.at(-1).cov_ee_m2 > fading[0].cov_ee_m2);
  assert.ok(
    rows.some(
      (t) =>
        m.schedule[t.dwell_index].cycle_index === 9 && t.state === "confirmed"
    )
  );
});
test("military: no received power yields no detections or estimated tracks", () => {
  const detected = detectMilitary(
    new Float32Array(m.returns.length),
    m.schedule,
    c
  );
  assert.deepEqual(detected.detections, []);
  assert.deepEqual(trackMilitary([], m.schedule, c), {
    tracks: [],
    associations: [],
    states: [],
  });
});
const secondary = simulateSecondary();
test("secondary: Mode A code is a string preserving leading zeros, not an aircraft identifier", () => {
  const values = secondary.reports
    .filter((r) => r.mode_a_code !== null)
    .map((r) => r.mode_a_code);
  assert.ok(values.includes("0421"));
  for (const value of values) assert.match(value, /^[0-7]{4}$/);
  for (const r of secondary.reports)
    assert.equal(Object.hasOwn(r, "target_id"), false);
});
test("secondary: pressure altitude is not transformed into geometric height or ground range", () => {
  const values = secondary.reports
    .filter((r) => r.pressure_altitude_ft !== null)
    .map((r) => r.pressure_altitude_ft);
  assert.deepEqual(
    [...new Set(values)].sort((a, b) => a - b),
    [4600, 6800]
  );
  for (const value of values) assert.equal(value % 100, 0);
  for (const r of secondary.reports) {
    assert.equal(Object.hasOwn(r, "east_m"), false);
    assert.equal(Object.hasOwn(r, "north_m"), false);
    assert.equal(Object.hasOwn(r, "up_m"), false);
  }
});
test("secondary: every report exactly retains one valid decoded reply and declared availability", () => {
  assert.equal(
    secondary.reports.length,
    secondary.decodedReplies.filter((r) => r.validity === "valid").length
  );
  for (const { report_id, ...r } of secondary.reports) {
    assert.ok(report_id);
    assert.deepEqual(
      r,
      secondary.decodedReplies.find((raw) => raw.reply_id === r.reply_id)
    );
    const i = secondary.interrogations.find(
      (i) => i.interrogation_id === r.interrogation_id
    );
    assert.ok(r.time_s >= i.start_s && r.time_s <= i.end_s);
    near(r.available_s - r.time_s, 0.08);
    if (i.mode === "mode_a") {
      assert.equal(r.pressure_altitude_ft, null);
      assert.ok(r.mode_a_code);
    } else assert.equal(r.mode_a_code, null);
  }
});
test("secondary: invalid replies, unknown altitude and missing replies remain distinct", () => {
  const invalid = secondary.decodedReplies.filter(
    (r) => r.validity === "invalid"
  );
  assert.equal(invalid.length, 2);
  for (const r of invalid)
    for (const key of [
      "slant_range_m",
      "bearing_deg",
      "mode_a_code",
      "pressure_altitude_ft",
    ])
      assert.equal(r[key], null);
  assert.ok(
    secondary.reports.some(
      (r) =>
        r.pressure_altitude_ft === null &&
        r.mode_a_code === null &&
        r.slant_range_m > 0
    )
  );
  const empty = secondary.interrogations.filter(
    (i) =>
      !secondary.decodedReplies.some(
        (r) => r.interrogation_id === i.interrogation_id
      )
  );
  assert.ok(empty.length > 0);
  for (const i of empty)
    assert.equal(
      secondary.reports.some((r) => r.interrogation_id === i.interrogation_id),
      false
    );
  assert.ok(secondary.reports.every((r) => r.slant_range_m > 0));
});
test("secondary: reply dropout and recovery occur without fabricated zero rows", () => {
  const has = (cycle, code) =>
    secondary.reports.some(
      (r) => r.mode_a_code === code && Math.floor(r.time_s / 4) === cycle
    );
  assert.ok(has(5, "0421"));
  for (const cycle of [6, 7, 8]) assert.equal(has(cycle, "0421"), false);
  assert.ok(has(9, "0421"));
});
test("secondary: noncooperative scene exists only in separate source truth", () => {
  assert.equal(
    secondary.truth.filter((t) => t.transponder === "disabled").length,
    secondary.interrogations.length
  );
  const rawText = JSON.stringify(secondary.decodedReplies),
    reportText = JSON.stringify(secondary.reports);
  assert.equal(rawText.includes("no-transponder"), false);
  assert.equal(reportText.includes("no-transponder"), false);
  // Source labels and transponder settings are never available to report processing.
  assert.deepEqual(
    deriveSecondaryReports(secondary.decodedReplies, secondary.interrogations),
    secondary.reports
  );
});
test("secondary: authored slant range follows 3D source geometry without using pressure altitude", () => {
  for (const r of secondary.reports.filter((r) => r.mode_a_code === "0421")) {
    const truth = secondaryTruthAt(r.time_s).find((t) => t.code === "0421");
    assert.ok(
      Math.abs(
        r.slant_range_m - Math.hypot(truth.east_m, truth.north_m, truth.up_m)
      ) <=
        scenarioConfigs.secondary.rangeNoiseM + 1e-7
    );
    assert.ok(r.slant_range_m > Math.hypot(truth.east_m, truth.north_m));
  }
});
test("secondary: source noise changes measurements without changing source scene or schedule", () => {
  const changed = synthesizeSecondary({
    ...scenarioConfigs.secondary,
    seed: scenarioConfigs.secondary.seed + 1,
  });
  assert.deepEqual(changed.truth, secondary.truth);
  assert.deepEqual(changed.interrogations, secondary.interrogations);
  assert.notDeepEqual(changed.decodedReplies, secondary.decodedReplies);
});
test("secondary: report processing is causal, source-qualified, and empty-input safe", () => {
  const cutoff = 12,
    prior = secondary.decodedReplies.filter((r) => r.available_s <= cutoff);
  assert.deepEqual(
    deriveSecondaryReports(prior, secondary.interrogations),
    secondary.reports.filter((r) => r.available_s <= cutoff)
  );
  assert.deepEqual(deriveSecondaryReports([], secondary.interrogations), []);
  assert.throws(() => deriveSecondaryReports(secondary.decodedReplies, []));
});
