import test from "node:test";
import assert from "node:assert/strict";
import {
  config,
  simulate,
  synthesize,
  detect,
  trackDetections,
  predict,
  update,
  offset,
} from "./model.mjs";
import { createPacket } from "./build.mjs";

const result = simulate();
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}`,
  );

test("generator repeats every authored source byte", async () => {
  const a = await createPacket(),
    b = await createPacket();
  assert.equal(a.files.size, b.files.size);
  for (const [name, bytes] of a.files)
    assert.deepEqual(bytes, b.files.get(name), name);
});
test("seed changes received noise and inference, not declared scene positions", () => {
  const a = synthesize(),
    b = synthesize({ ...config, seed: config.seed + 1 });
  assert.notDeepEqual(a.returns, b.returns);
  assert.deepEqual(a.truth, b.truth);
  assert.deepEqual(a.schedule, b.schedule);
});
test("all 1152 dwell intervals cover exactly 64 seconds in order", () => {
  assert.equal(result.schedule.length, 16 * 72);
  result.schedule.forEach((d, i) => {
    near(d.start_s, i / 18, 1e-9);
    near(d.end_s, (i + 1) / 18, 1e-9);
    assert.equal(d.scan_index, Math.floor(i / 72));
    assert.equal(d.azimuth_index, i % 72);
    assert.equal(d.beam_azimuth_deg, (i % 72) * 5);
    assert.ok(d.start_s < d.end_s);
    if (i) near(d.start_s, result.schedule[i - 1].end_s);
  });
  near(result.schedule.at(-1).end_s, 64);
});
test("scene truth is retained at dwell end with the two independent local paths", () => {
  assert.equal(result.truth.length, 2304);
  for (const row of result.truth) {
    if (row.target_id === "scene-a") {
      near(row.east_m, 650 + 18 * row.time_s, 1e-8);
      near(row.north_m, 1650 - 10 * row.time_s, 1e-8);
    } else {
      near(row.east_m, -1400 + 10 * row.time_s, 1e-8);
      near(row.north_m, 1100 + 6 * row.time_s, 1e-8);
    }
  }
});
test("all retained cells are finite nonnegative relative power", () => {
  assert.equal(result.returns.length, 16 * 72 * 64);
  for (const value of result.returns)
    assert.ok(Number.isFinite(value) && value >= 0);
});
test("thresholds independently match the declared range neighborhood calculation", () => {
  for (let s = 0; s < 16; s++)
    for (let a = 0; a < 72; a++)
      for (let r = 0; r < 64; r++) {
        const training = [];
        for (let x = Math.max(0, r - 10); x <= Math.min(63, r + 10); x++)
          if (Math.abs(x - r) > 2)
            training.push(result.returns[(s * 72 + a) * 64 + x]);
        const expected = Math.fround(
          Math.max(
            0.6,
            (4 * training.reduce((sum, v) => sum + v, 0)) / training.length,
          ),
        );
        assert.equal(result.thresholds[(s * 72 + a) * 64 + r], expected);
      }
});
test("detections cite retained peak power, threshold, epoch and local maximum", () => {
  for (const d of result.detections) {
    const index = offset(d.scan_index, d.azimuth_index, d.range_index),
      dwell = result.schedule[d.scan_index * 72 + d.azimuth_index];
    assert.equal(d.power, result.returns[index]);
    assert.ok(d.power >= result.thresholds[index]);
    near(d.time_s, (dwell.start_s + dwell.end_s) / 2, 1e-9);
    assert.ok(d.range_index > 0 && d.range_index < 63);
    for (let a = -1; a <= 1; a++)
      for (let r = -1; r <= 1; r++)
        assert.ok(
          d.power >=
            result.returns[
              offset(
                d.scan_index,
                (d.azimuth_index + a + 72) % 72,
                d.range_index + r,
              )
            ],
        );
  }
});
test("detector and tracker cannot produce targets from an empty input", () => {
  const detection = detect(
    new Float32Array(result.returns.length),
    result.schedule,
  );
  assert.equal(detection.detections.length, 0);
  assert.deepEqual(trackDetections([]), {
    tracks: [],
    associations: [],
    states: [],
  });
});
test("inference uses received arrays and detections without a truth interface", () => {
  const poisoned = {
    ...config,
    get truth() {
      throw Error("Truth access");
    },
    get targets() {
      throw Error("Scene access");
    },
  };
  assert.deepEqual(
    detect(result.returns, result.schedule, poisoned).detections,
    result.detections,
  );
  assert.deepEqual(
    trackDetections(result.detections, poisoned).tracks,
    result.tracks,
  );
  const shifted = trackDetections(
    result.detections.map((d) => ({
      ...d,
      east_m: d.east_m + 500,
      north_m: d.north_m - 200,
    })),
  );
  shifted.tracks.forEach((t, i) => {
    const original = result.tracks[i];
    assert.equal(t.track_id, original.track_id);
    assert.equal(t.state, original.state);
    near(t.east_m - original.east_m, 500, 2e-8);
    near(t.north_m - original.north_m, -200, 2e-8);
    near(t.cov_ee_m2, original.cov_ee_m2);
    near(t.cov_nn_m2, original.cov_nn_m2);
  });
});
test("all associations are one-to-one within a scan and refer to observed detections", () => {
  const used = new Set(),
    tracks = new Set(result.tracks.map((t) => `${t.track_id}:${t.scan_index}`));
  for (const a of result.associations) {
    assert.ok(!used.has(a.detection_id));
    used.add(a.detection_id);
    const d = result.detections.find((d) => d.detection_id === a.detection_id);
    assert.equal(d.scan_index, a.scan_index);
    assert.ok(tracks.has(`${a.track_id}:${a.scan_index}`));
    assert.equal(
      result.associations.filter(
        (other) =>
          other.track_id === a.track_id && other.scan_index === a.scan_index,
      ).length,
      1,
    );
  }
  assert.equal(used.size, result.detections.length);
});
test("tracks export predicted scan-end states with distinct observation and estimate epochs", () => {
  for (const t of result.tracks) {
    assert.equal(t.time_s, (t.scan_index + 1) * 4);
    const associated = result.associations.filter(
      (a) => a.scan_index === t.scan_index && a.track_id === t.track_id,
    );
    assert.equal(associated.length, t.state === "coasting" ? 0 : 1);
    for (const a of associated)
      assert.ok(
        result.detections.find((d) => d.detection_id === a.detection_id)
          .time_s < t.time_s,
      );
  }
});
test("missing returns lead to coasting, growing uncertainty and later reacquisition", () => {
  for (const [id, start, end] of [
    ["track-001", 6, 8],
    ["track-002", 11, 12],
  ]) {
    const rows = result.tracks.filter((t) => t.track_id === id);
    let variance = rows.find((t) => t.scan_index === start - 1).cov_ee_m2;
    for (let scan = start; scan <= end; scan++) {
      const row = rows.find((t) => t.scan_index === scan);
      assert.equal(row.state, "coasting");
      assert.ok(row.cov_ee_m2 > variance);
      variance = row.cov_ee_m2;
    }
    const recovered = rows.find((t) => t.scan_index === end + 1);
    assert.equal(recovered.state, "confirmed");
    assert.ok(recovered.cov_ee_m2 < variance);
  }
});
test("a brief extra return creates a tentative track then expires after four misses", () => {
  const rows = result.tracks.filter((t) => t.track_id === "track-003");
  assert.deepEqual(
    rows.map((t) => t.scan_index),
    [4, 5, 6, 7],
  );
  assert.deepEqual(
    rows.map((t) => t.state),
    ["tentative", "coasting", "coasting", "coasting"],
  );
});
test("full 4x4 covariances are symmetric and positive definite", () => {
  for (const s of result.states) {
    const p = Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => s[`p${i}${j}`]),
    );
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) near(p[i][j], p[j][i], 1e-8);
    // Independent Cholesky decomposition: every pivot must remain positive.
    const l = Array.from({ length: 4 }, () => Array(4).fill(0));
    for (let i = 0; i < 4; i++)
      for (let j = 0; j <= i; j++) {
        let residual = p[i][j];
        for (let k = 0; k < j; k++) residual -= l[i][k] * l[j][k];
        if (i === j) {
          assert.ok(residual > 0);
          l[i][j] = Math.sqrt(residual);
        } else l[i][j] = residual / l[j][j];
      }
  }
});
test("Kalman prediction and Joseph update match an independent scalar case", () => {
  const c = { ...config, accelerationSigmaMPerS2: 0, measurementSigmaM: 2 };
  const t = {
    id: "test",
    time: 0,
    x: [10, 20, 3, 4],
    P: [
      [4, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    hits: 1,
    misses: 0,
  };
  const p = predict(t, 2, c);
  assert.deepEqual(p.x, [16, 28, 3, 4]);
  near(p.P[0][0], 8);
  near(p.P[0][2], 2);
  const u = update(p, { east_m: 19, north_m: 25 }, c);
  near(u.x[0], 18);
  near(u.x[1], 26);
  near(u.x[2], 3.5);
  near(u.x[3], 3.5);
  near(u.P[0][0], 8 / 3);
  near(u.P[2][2], 2 / 3);
});
test("tracking covariance is model confidence, while calibration remains unresolved", async () => {
  const p = await createPacket();
  assert.deepEqual(p.context.calibrations, []);
  assert.equal(
    p.context.acquisitions[0].channels[0].calibration.state,
    "unresolved",
  );
  assert.equal(
    p.observation.extensions["org.disclosure.simulation"].physicalValidation,
    "not_performed",
  );
  assert.equal(p.profile.uncertainty.confidenceProbability, 0.95);
});
