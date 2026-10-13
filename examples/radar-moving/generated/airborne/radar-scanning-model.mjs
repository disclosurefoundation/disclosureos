// Reproducible reduced radar model. No RF propagation or hardware performance is implied.
export const config = Object.freeze({
  seed: 20261013,
  scans: 16,
  azimuthBins: 72,
  rangeBins: 64,
  scanSeconds: 4,
  rangeOriginM: 25,
  rangeStepM: 50,
  azimuthOriginDeg: 0,
  azimuthStepDeg: 5,
  beamWidthDeg: 4.945122,
  timeOrigin: "2026-07-28T22:00:00Z",
  measurementSigmaM: 45,
  accelerationSigmaMPerS2: 1.5,
  initialVelocitySigmaMPerS: 30,
  associationGateSquared: 9.21034,
});
const rad = Math.PI / 180;
const wrap = (a) => ((a + 540) % 360) - 180;
const round = (v) => Number(v.toFixed(9));
export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function scenarioAt(time, scan) {
  return [
    {
      target_id: "scene-a",
      east_m: 650 + 18 * time,
      north_m: 1650 - 10 * time,
      gain: scan >= 6 && scan <= 8 ? 0.015 : 3.8,
    },
    {
      target_id: "scene-b",
      east_m: -1400 + 10 * time,
      north_m: 1100 + 6 * time,
      gain: scan >= 11 && scan <= 12 ? 0.015 : 3.2,
    },
  ];
}
export const offset = (scan, azimuth, range, c = config) =>
  (scan * c.azimuthBins + azimuth) * c.rangeBins + range;
export function synthesize(c = config) {
  const rng = randomGenerator(c.seed),
    schedule = [],
    truth = [];
  const returns = new Float32Array(c.scans * c.azimuthBins * c.rangeBins);
  for (let scan = 0; scan < c.scans; scan++) {
    for (let az = 0; az < c.azimuthBins; az++) {
      const start = scan * c.scanSeconds + (az * c.scanSeconds) / c.azimuthBins;
      const end =
        scan * c.scanSeconds + ((az + 1) * c.scanSeconds) / c.azimuthBins;
      const angle = c.azimuthOriginDeg + az * c.azimuthStepDeg;
      schedule.push({
        scan_index: scan,
        azimuth_index: az,
        start_s: round(start),
        end_s: round(end),
        beam_azimuth_deg: angle,
        beam_width_deg: c.beamWidthDeg,
      });
      for (const p of scenarioAt(end, scan))
        truth.push({
          target_id: p.target_id,
          scan_index: scan,
          time_s: round(end),
          east_m: round(p.east_m),
          north_m: round(p.north_m),
        });
      const targets = scenarioAt((start + end) / 2, scan);
      for (let bin = 0; bin < c.rangeBins; bin++) {
        const range = c.rangeOriginM + bin * c.rangeStepM;
        const thermal = -0.055 * Math.log(Math.max(1e-12, 1 - rng()));
        const texture = 0.8 + 0.4 * rng();
        // A stationary, broad angular/range component is a declared clutter model.
        const clutter =
          0.52 *
          Math.exp(-0.5 * (wrap(angle - 145) / 15) ** 2) *
          Math.exp(-0.5 * ((range - 1050) / 240) ** 2) *
          texture;
        let power = 0.025 + thermal + clutter;
        for (const p of targets) {
          const targetRange = Math.hypot(p.east_m, p.north_m);
          const targetAngle = Math.atan2(p.east_m, p.north_m) / rad;
          power +=
            p.gain *
            Math.exp(-0.5 * (wrap(angle - targetAngle) / 2.1) ** 2) *
            Math.exp(-0.5 * ((range - targetRange) / 36) ** 2);
        }
        // One short, unexplained return. It must be handled like all other detections.
        if (scan === 4)
          power +=
            2.4 *
            Math.exp(-0.5 * (wrap(angle - 235) / 2.1) ** 2) *
            Math.exp(-0.5 * ((range - 2150) / 36) ** 2);
        returns[offset(scan, az, bin, c)] = power;
      }
    }
  }
  return { returns, schedule, truth };
}

// Empirical range-neighborhood threshold, not a calibrated CFAR probability.
export function detect(returns, schedule, c = config) {
  if (returns.length !== c.scans * c.azimuthBins * c.rangeBins)
    throw Error("Return shape mismatch");
  const thresholds = new Float32Array(returns.length),
    detections = [];
  for (let scan = 0; scan < c.scans; scan++)
    for (let az = 0; az < c.azimuthBins; az++) {
      for (let bin = 0; bin < c.rangeBins; bin++) {
        let total = 0,
          n = 0;
        for (let delta = -10; delta <= 10; delta++) {
          if (
            Math.abs(delta) <= 2 ||
            bin + delta < 0 ||
            bin + delta >= c.rangeBins
          )
            continue;
          total += returns[offset(scan, az, bin + delta, c)];
          n++;
        }
        thresholds[offset(scan, az, bin, c)] = Math.max(0.6, (4 * total) / n);
      }
      for (let bin = 1; bin < c.rangeBins - 1; bin++) {
        const index = offset(scan, az, bin, c),
          power = returns[index];
        if (!(power >= thresholds[index])) continue;
        let peak = true;
        // Across-azimuth comparison is batch processing after the complete scan.
        for (let da = -1; da <= 1; da++)
          for (let dr = -1; dr <= 1; dr++) {
            if (!da && !dr) continue;
            const other = offset(
              scan,
              (az + da + c.azimuthBins) % c.azimuthBins,
              bin + dr,
              c,
            );
            if (
              returns[other] > power ||
              (returns[other] === power && other < index)
            )
              peak = false;
          }
        if (!peak) continue;
        // A center-of-power estimate within the retained 3x3 neighborhood.
        let sum = 0,
          east = 0,
          north = 0;
        for (let da = -1; da <= 1; da++)
          for (let dr = -1; dr <= 1; dr++) {
            const a = (az + da + c.azimuthBins) % c.azimuthBins;
            const r = c.rangeOriginM + (bin + dr) * c.rangeStepM;
            const w = Math.max(0, returns[offset(scan, a, bin + dr, c)] - 0.08);
            const theta = (c.azimuthOriginDeg + a * c.azimuthStepDeg) * rad;
            east += w * r * Math.sin(theta);
            north += w * r * Math.cos(theta);
            sum += w;
          }
        const dwell = schedule[scan * c.azimuthBins + az];
        detections.push({
          detection_id: `detection-${String(detections.length + 1).padStart(3, "0")}`,
          scan_index: scan,
          azimuth_index: az,
          range_index: bin,
          time_s: round((dwell.start_s + dwell.end_s) / 2),
          east_m: round(east / sum),
          north_m: round(north / sum),
          power: Number(power),
        });
      }
    }
  return { thresholds, detections };
}

const eye = (n) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Number(i === j)),
  );
const zeros = (n, m = n) => Array.from({ length: n }, () => Array(m).fill(0));
const transpose = (a) => a[0].map((_, j) => a.map((r) => r[j]));
const multiply = (a, b) =>
  a.map((row) =>
    b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)),
  );
const add = (a, b) => a.map((row, i) => row.map((v, j) => v + b[i][j]));
const subtract = (a, b) => a.map((row, i) => row.map((v, j) => v - b[i][j]));
const inverse2 = (a) => {
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  if (!(det > 0)) throw Error("Innovation covariance is not positive definite");
  return [
    [a[1][1] / det, -a[0][1] / det],
    [-a[1][0] / det, a[0][0] / det],
  ];
};
export function predict(track, time, c = config) {
  const dt = time - track.time;
  if (dt < -1e-7) throw Error("Cannot predict backward");
  const f = [
    [1, 0, dt, 0],
    [0, 1, 0, dt],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  const g = [
    [(dt * dt) / 2, 0],
    [0, (dt * dt) / 2],
    [dt, 0],
    [0, dt],
  ];
  const q = multiply(g, transpose(g)).map((r) =>
    r.map((v) => v * c.accelerationSigmaMPerS2 ** 2),
  );
  return {
    ...track,
    time,
    x: multiply(
      f,
      track.x.map((v) => [v]),
    ).flat(),
    P: add(multiply(multiply(f, track.P), transpose(f)), q),
  };
}
const H = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
];
function innovation(track, detection, c) {
  const R = [
    [c.measurementSigmaM ** 2, 0],
    [0, c.measurementSigmaM ** 2],
  ];
  const residual = [
    [detection.east_m - track.x[0]],
    [detection.north_m - track.x[1]],
  ];
  const S = add(multiply(multiply(H, track.P), transpose(H)), R),
    inverse = inverse2(S);
  const distance = multiply(
    multiply(transpose(residual), inverse),
    residual,
  )[0][0];
  return { R, residual, inverse, distance };
}
export function update(track, detection, c = config) {
  const { R, residual, inverse } = innovation(track, detection, c);
  const K = multiply(multiply(track.P, transpose(H)), inverse);
  const corrected = add(
    track.x.map((v) => [v]),
    multiply(K, residual),
  ).flat();
  // Joseph form retains symmetry/positive semidefiniteness under numerical error.
  const IKH = subtract(eye(4), multiply(K, H));
  const P = add(
    multiply(multiply(IKH, track.P), transpose(IKH)),
    multiply(multiply(K, R), transpose(K)),
  );
  return { ...track, x: corrected, P, hits: track.hits + 1, misses: 0 };
}
export function trackDetections(detections, c = config) {
  let active = [],
    serial = 0;
  const tracks = [],
    associations = [],
    states = [];
  for (let scan = 0; scan < c.scans; scan++) {
    const used = new Set();
    const reported = detections
      .filter((d) => d.scan_index === scan)
      .sort(
        (a, b) =>
          a.time_s - b.time_s || a.detection_id.localeCompare(b.detection_id),
      );
    for (const d of reported) {
      let best = null;
      for (const t of active) {
        if (used.has(t.id)) continue;
        const predicted = predict(t, d.time_s, c),
          distance = innovation(predicted, d, c).distance;
        if (
          distance <= c.associationGateSquared &&
          (!best || distance < best.distance)
        )
          best = { t, predicted, distance };
      }
      let selected;
      if (best) {
        selected = update(best.predicted, d, c);
        active = active.map((t) => (t.id === selected.id ? selected : t));
      } else {
        const r = c.measurementSigmaM ** 2,
          v = c.initialVelocitySigmaMPerS ** 2;
        selected = {
          id: `track-${String(++serial).padStart(3, "0")}`,
          time: d.time_s,
          x: [d.east_m, d.north_m, 0, 0],
          P: [
            [r, 0, 0, 0],
            [0, r, 0, 0],
            [0, 0, v, 0],
            [0, 0, 0, v],
          ],
          hits: 1,
          misses: 0,
        };
        active.push(selected);
      }
      used.add(selected.id);
      associations.push({
        track_id: selected.id,
        scan_index: scan,
        detection_id: d.detection_id,
      });
    }
    active = active
      .map((t) =>
        predict(
          { ...t, misses: used.has(t.id) ? 0 : t.misses + 1 },
          (scan + 1) * c.scanSeconds,
          c,
        ),
      )
      .filter((t) => t.misses <= 3);
    for (const t of active) {
      const state = !used.has(t.id)
        ? "coasting"
        : t.hits >= 3
          ? "confirmed"
          : "tentative";
      tracks.push({
        track_id: t.id,
        scan_index: scan,
        time_s: t.time,
        state,
        east_m: round(t.x[0]),
        north_m: round(t.x[1]),
        velocity_east_m_s: round(t.x[2]),
        velocity_north_m_s: round(t.x[3]),
        cov_ee_m2: round(t.P[0][0]),
        cov_en_m2: round((t.P[0][1] + t.P[1][0]) / 2),
        cov_nn_m2: round(t.P[1][1]),
      });
      states.push({
        track_id: t.id,
        scan_index: scan,
        time_s: t.time,
        misses: t.misses,
        hits: t.hits,
        ...Object.fromEntries(
          t.P.flatMap((r, i) => r.map((v, j) => [`p${i}${j}`, round(v)])),
        ),
      });
    }
  }
  return { tracks, associations, states };
}

export function simulate(c = config) {
  const synthesis = synthesize(c);
  const detection = detect(synthesis.returns, synthesis.schedule, c);
  // Deliberately accept only detection rows: the tracker has no truth input.
  return {
    ...synthesis,
    ...detection,
    ...trackDetections(detection.detections, c),
  };
}
