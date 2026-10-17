import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  scenarioConfigs,
  simulate,
  synthesize,
  detect,
  cellPosition,
  scenarioAt,
} from "./model.mjs";
import { trackDetections } from "../radar-scanning/model.mjs";
import { createPacket } from "./build.mjs";
const near = (actual, expected, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}`,
  );
for (const [scenario, c] of Object.entries(scenarioConfigs)) {
  const m = simulate(c);
  test(`${scenario}: every retained packet byte reproduces`, async () => {
    const a = await createPacket(scenario),
      b = await createPacket(scenario);
    assert.equal(a.files.size, 18);
    for (const [name, bytes] of a.files)
      assert.deepEqual(bytes, b.files.get(name), name);
  });
  test(`${scenario}: retained model executes outside the repository`, async () => {
    const packet = await createPacket(scenario),
      dir = await mkdtemp(path.join(tmpdir(), "radar-model-"));
    try {
      for (const file of ["model.mjs", "radar-scanning-model.mjs"])
        await writeFile(path.join(dir, file), packet.files.get(file));
      const downloaded = await import(
        pathToFileURL(path.join(dir, "model.mjs")).href
      );
      assert.deepEqual(
        downloaded.simulate(downloaded.scenarioConfigs[scenario]),
        m,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test(`${scenario}: dwell-midpoint telemetry spans a level constant-speed turn`, () => {
    assert.equal(m.platformPose.length, 1152);
    assert.equal(m.schedule.length, 1152);
    for (let i = 0; i < m.platformPose.length; i++) {
      const p = m.platformPose[i],
        s = m.schedule[i];
      assert.equal(p.scan_index, s.scan_index);
      assert.equal(p.azimuth_index, s.azimuth_index);
      near(p.time_s, (s.start_s + s.end_s) / 2, 1e-9);
      near(p.up_m, c.platformUpM);
      near(
        p.heading_deg,
        c.platformHeadingDeg + c.platformTurnRateDegPerS * p.time_s,
        1e-8,
      );
      if (i) {
        const previous = m.platformPose[i - 1],
          dt = p.time_s - previous.time_s;
        near(
          Math.hypot(p.east_m - previous.east_m, p.north_m - previous.north_m) /
            dt,
          c.platformSpeedMPerS,
          1e-4,
        );
      }
    }
    assert.ok(
      Math.hypot(
        m.platformPose.at(-1).east_m - m.platformPose[0].east_m,
        m.platformPose.at(-1).north_m - m.platformPose[0].north_m,
      ) > 400,
    );
  });
  test(`${scenario}: source noise changes independently of telemetry and truth`, () => {
    const changed = synthesize({ ...c, seed: c.seed + 1 });
    assert.notDeepEqual(changed.returns, m.returns);
    assert.deepEqual(changed.platformPose, m.platformPose);
    assert.deepEqual(changed.truth, m.truth);
    for (const value of m.returns)
      assert.ok(Number.isFinite(value) && value >= 0);
  });
  test(`${scenario}: detector uses per-cell platform telemetry and no scene oracle`, () => {
    const cNoTruth = {
      ...c,
      get truth() {
        throw Error("Truth accessed");
      },
      get targets() {
        throw Error("Scene accessed");
      },
    };
    assert.deepEqual(
      detect(m.returns, m.schedule, m.platformPose, cNoTruth).detections,
      m.detections,
    );
    assert.deepEqual(trackDetections(m.detections, cNoTruth).tracks, m.tracks);
    const shifted = m.platformPose.map((p) => ({
      ...p,
      east_m: p.east_m + 700,
      north_m: p.north_m - 350,
    }));
    const updated = detect(m.returns, m.schedule, shifted, c);
    assert.deepEqual(updated.thresholds, m.thresholds);
    updated.detections.forEach((d, i) => {
      near(d.east_m - m.detections[i].east_m, 700, 3e-8);
      near(d.north_m - m.detections[i].north_m, -350, 3e-8);
      assert.equal(d.power, m.detections[i].power);
    });
    assert.throws(() =>
      detect(m.returns, m.schedule, m.platformPose.slice(1), c),
    );
  });
  test(`${scenario}: ownship compensation preserves the fixed landmark while native bearings change`, () => {
    const landmark =
      scenario === "airborne"
        ? { east_m: 2600, north_m: -500 }
        : { east_m: 1300, north_m: -100 };
    const matched = Array.from(
      { length: c.scans },
      (_, scan) =>
        m.detections
          .filter((d) => d.scan_index === scan)
          .sort(
            (a, b) =>
              Math.hypot(
                a.east_m - landmark.east_m,
                a.north_m - landmark.north_m,
              ) -
              Math.hypot(
                b.east_m - landmark.east_m,
                b.north_m - landmark.north_m,
              ),
          )[0],
    );
    for (const detection of matched)
      assert.ok(
        Math.hypot(
          detection.east_m - landmark.east_m,
          detection.north_m - landmark.north_m,
        ) < 80,
      );
    const nativeBearing = (p) =>
      (Math.atan2(landmark.east_m - p.east_m, landmark.north_m - p.north_m) *
        180) /
        Math.PI -
      p.heading_deg;
    assert.ok(
      Math.abs(
        nativeBearing(m.platformPose.at(-1)) - nativeBearing(m.platformPose[0]),
      ) > 20,
    );
    const frozen = m.platformPose.map((p) => ({
      ...p,
      ...Object.fromEntries(
        ["east_m", "north_m", "up_m", "heading_deg"].map((key) => [
          key,
          m.platformPose[0][key],
        ]),
      ),
    }));
    const incorrect = detect(m.returns, m.schedule, frozen, c);
    const last = matched.at(-1),
      wrong = incorrect.detections.find(
        (d) => d.detection_id === last.detection_id,
      );
    assert.ok(
      Math.hypot(wrong.east_m - last.east_m, wrong.north_m - last.north_m) >
        400,
    );
  });
  test(`${scenario}: actual fading produces prediction gaps and later updates`, () => {
    const a0 = scenarioAt(0, 0, c)[0];
    const d0 = m.detections
      .filter((d) => d.scan_index === 0)
      .sort(
        (a, b) =>
          Math.hypot(a.east_m - a0.east_m, a.north_m - a0.north_m) -
          Math.hypot(b.east_m - a0.east_m, b.north_m - a0.north_m),
      )[0];
    const id = m.associations.find(
      (a) => a.detection_id === d0.detection_id,
    ).track_id;
    const rows = m.tracks.filter((t) => t.track_id === id);
    let covariance = rows.find((t) => t.scan_index === 5).cov_ee_m2;
    for (let scan = 6; scan <= 8; scan++) {
      const row = rows.find((t) => t.scan_index === scan);
      assert.equal(row.state, "coasting");
      assert.ok(row.cov_ee_m2 > covariance);
      covariance = row.cov_ee_m2;
    }
    assert.equal(rows.find((t) => t.scan_index === 9).state, "confirmed");
    assert.ok(rows.find((t) => t.scan_index === 9).cov_ee_m2 < covariance);
  });
  test(`${scenario}: completed-scan tracks have nonnegative covariance and linked input detections`, () => {
    const pairs = new Set();
    for (const a of m.associations) {
      const key = `${a.track_id}:${a.scan_index}`;
      assert.ok(!pairs.has(key));
      pairs.add(key);
      assert.ok(
        m.detections.some(
          (d) =>
            d.detection_id === a.detection_id && d.scan_index === a.scan_index,
        ),
      );
    }
    for (const t of m.tracks) {
      assert.equal(t.time_s, (t.scan_index + 1) * 4);
      assert.ok(t.cov_ee_m2 >= 0 && t.cov_nn_m2 >= 0);
      assert.ok(t.cov_ee_m2 * t.cov_nn_m2 - t.cov_en_m2 ** 2 >= -1e-6);
    }
  });
  test(`${scenario}: empty received power produces no detections or tracks`, () => {
    assert.deepEqual(
      detect(new Float32Array(m.returns.length), m.schedule, m.platformPose, c)
        .detections,
      [],
    );
    assert.deepEqual(trackDetections([], c), {
      tracks: [],
      associations: [],
      states: [],
    });
  });
}
test("slant projection rejects impossible ranges and reproduces the right triangle", () => {
  const c = scenarioConfigs.airborne,
    p = { east_m: 100, north_m: 200, up_m: 900, heading_deg: 90 };
  assert.equal(cellPosition(p, 0, 899, c), undefined);
  const target = cellPosition(p, 0, 1500, c);
  near(target.east_m, 1300);
  near(target.north_m, 200);
  const nadir = cellPosition(p, 0, 900, c);
  near(nadir.east_m, 100);
  near(nadir.north_m, 200);
});

test("airborne: an unprojectable peak is not rescued by a neighboring valid cell", () => {
  const c = scenarioConfigs.airborne,
    source = synthesize(c);
  const powers = new Float32Array(source.returns.length);
  powers[10 * c.rangeBins + 8] = 5;
  powers[10 * c.rangeBins + 9] = 2;
  const result = detect(powers, source.schedule, source.platformPose, c);
  assert.equal(result.detections.length, 0);
});
