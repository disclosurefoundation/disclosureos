// Deterministic teaching models. No physical RF, military performance or identification claim.
import {
  config as fixedConfig,
  randomGenerator,
  predict,
  update,
} from "./radar-scanning-model.mjs";
const rad = Math.PI / 180;
const round = (value) => Number(value.toFixed(9));
const wrap = (value) => ((value + 540) % 360) - 180;
export const scenarioConfigs = Object.freeze({
  military: Object.freeze({
    timeOrigin: fixedConfig.timeOrigin,
    beamWidthDeg: fixedConfig.beamWidthDeg,
    accelerationSigmaMPerS2: fixedConfig.accelerationSigmaMPerS2,
    initialVelocitySigmaMPerS: fixedConfig.initialVelocitySigmaMPerS,
    associationGateSquared: fixedConfig.associationGateSquared,
    scenario: "military",
    seed: 20261016,
    cycles: 16,
    rangeBins: 64,
    rangeOriginM: 25,
    rangeStepM: 50,
    sectorStartDeg: -55,
    sectorEndDeg: 55,
    searchDwellSeconds: 0.1,
    revisitDwellSeconds: 0.18,
    measurementSigmaM: 70,
    maxCoastSeconds: 8,
  }),
  secondary: Object.freeze({
    scenario: "secondary",
    seed: 20261017,
    cycles: 16,
    cycleSeconds: 4,
    timeOrigin: fixedConfig.timeOrigin,
    beamWidthDeg: 50,
    processingDelaySeconds: 0.08,
    maxSlantRangeM: 6000,
    rangeNoiseM: 12,
    bearingNoiseDeg: 0.12,
  }),
});
export function beamSchedule(c = scenarioConfigs.military) {
  const schedule = [];
  let time = 0;
  const append = (cycle, bearing, purpose) => {
    const duration =
      purpose === "search" ? c.searchDwellSeconds : c.revisitDwellSeconds;
    schedule.push({
      dwell_index: schedule.length,
      cycle_index: cycle,
      start_s: round(time),
      end_s: round(time + duration),
      beam_azimuth_deg: round((bearing + 360) % 360),
      beam_width_deg: c.beamWidthDeg,
      purpose,
    });
    time += duration;
  };
  for (let cycle = 0; cycle < c.cycles; cycle++) {
    for (let slot = 0; slot < 12; slot++) {
      append(cycle, c.sectorStartDeg + slot * 10, "search");
      if (slot === 2 || slot === 8) append(cycle, 26 + cycle * 0.5, "revisit");
      if (slot === 5 || slot === 11)
        append(cycle, -34 + cycle * 0.7, "revisit");
    }
  }
  return schedule;
}
export function militaryTruthAt(time, cycle) {
  return [
    {
      target_id: "scene-a",
      east_m: 900 + 12 * time,
      north_m: 1900 - 4 * time,
      gain: cycle >= 6 && cycle <= 8 ? 0.005 : 4.2,
    },
    {
      target_id: "scene-b",
      east_m: -1000 + 10 * time,
      north_m: 1500 + 3 * time,
      gain: cycle === 11 || cycle === 12 ? 0.005 : 3.7,
    },
  ];
}
export function synthesizeMilitary(c = scenarioConfigs.military) {
  const rng = randomGenerator(c.seed),
    schedule = beamSchedule(c),
    truth = [];
  const returns = new Float32Array(schedule.length * c.rangeBins);
  for (const dwell of schedule) {
    const time = (dwell.start_s + dwell.end_s) / 2,
      scene = militaryTruthAt(time, dwell.cycle_index);
    for (const target of scene)
      truth.push({
        target_id: target.target_id,
        dwell_index: dwell.dwell_index,
        time_s: round(time),
        east_m: round(target.east_m),
        north_m: round(target.north_m),
      });
    for (let bin = 0; bin < c.rangeBins; bin++) {
      const range = c.rangeOriginM + bin * c.rangeStepM;
      let power = 0.025 - 0.055 * Math.log(Math.max(1e-12, 1 - rng()));
      power +=
        0.42 *
        Math.exp(-0.5 * (wrap(dwell.beam_azimuth_deg + 15) / 14) ** 2) *
        Math.exp(-0.5 * ((range - 900) / 240) ** 2) *
        (0.8 + 0.4 * rng());
      for (const target of scene) {
        const bearing = Math.atan2(target.east_m, target.north_m) / rad;
        power +=
          target.gain *
          Math.exp(-0.5 * (wrap(dwell.beam_azimuth_deg - bearing) / 2.1) ** 2) *
          Math.exp(
            -0.5 *
              ((range - Math.hypot(target.east_m, target.north_m)) / 36) ** 2
          );
      }
      if (dwell.cycle_index === 4)
        power +=
          2.4 *
          Math.exp(-0.5 * (wrap(dwell.beam_azimuth_deg + 5) / 2.1) ** 2) *
          Math.exp(-0.5 * ((range - 2200) / 36) ** 2);
      returns[dwell.dwell_index * c.rangeBins + bin] = power;
    }
  }
  return { schedule, returns, truth };
}
export function detectMilitary(
  returns,
  schedule,
  c = scenarioConfigs.military
) {
  if (returns.length !== schedule.length * c.rangeBins)
    throw Error("Return shape mismatch");
  const thresholds = new Float32Array(returns.length),
    detections = [];
  for (const dwell of schedule) {
    const start = dwell.dwell_index * c.rangeBins;
    for (let bin = 0; bin < c.rangeBins; bin++) {
      let total = 0,
        count = 0;
      for (let delta = -10; delta <= 10; delta++) {
        const neighbor = bin + delta;
        if (Math.abs(delta) <= 2 || neighbor < 0 || neighbor >= c.rangeBins)
          continue;
        total += returns[start + neighbor];
        count++;
      }
      thresholds[start + bin] = Math.max(0.6, (4 * total) / count);
    }
    for (let bin = 1; bin < c.rangeBins - 1; bin++) {
      const power = returns[start + bin];
      if (
        power < thresholds[start + bin] ||
        power <= returns[start + bin - 1] ||
        power < returns[start + bin + 1]
      )
        continue;
      const range = c.rangeOriginM + bin * c.rangeStepM,
        bearing = dwell.beam_azimuth_deg * rad;
      detections.push({
        detection_id: `detection-${String(detections.length + 1).padStart(
          3,
          "0"
        )}`,
        dwell_index: dwell.dwell_index,
        range_index: bin,
        time_s: round((dwell.start_s + dwell.end_s) / 2),
        east_m: round(range * Math.sin(bearing)),
        north_m: round(range * Math.cos(bearing)),
        power: Number(power),
      });
    }
  }
  return { thresholds, detections };
}
const innovationDistance = (track, d, c) => {
  const ee = track.P[0][0] + c.measurementSigmaM ** 2,
    nn = track.P[1][1] + c.measurementSigmaM ** 2,
    en = (track.P[0][1] + track.P[1][0]) / 2;
  const e = d.east_m - track.x[0],
    n = d.north_m - track.x[1],
    det = ee * nn - en ** 2;
  if (!(det > 0)) throw Error("Innovation covariance is not positive definite");
  return (nn * e ** 2 - 2 * en * e * n + ee * n ** 2) / det;
};
export function trackMilitary(
  detections,
  schedule,
  c = scenarioConfigs.military
) {
  let active = [],
    serial = 0;
  const tracks = [],
    associations = [],
    states = [];
  for (const dwell of schedule) {
    const used = new Set(),
      rows = detections
        .filter((d) => d.dwell_index === dwell.dwell_index)
        .sort(
          (a, b) =>
            a.time_s - b.time_s || a.detection_id.localeCompare(b.detection_id)
        );
    for (const d of rows) {
      let best;
      for (const t of active) {
        if (used.has(t.id)) continue;
        const predicted = predict(t, d.time_s, c),
          distance = innovationDistance(predicted, d, c);
        if (
          distance <= c.associationGateSquared &&
          (!best || distance < best.distance)
        )
          best = { predicted, distance };
      }
      let selected;
      if (best) {
        selected = {
          ...update(best.predicted, d, c),
          lastDetectionTime: d.time_s,
        };
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
          lastDetectionTime: d.time_s,
        };
        active.push(selected);
      }
      used.add(selected.id);
      associations.push({
        track_id: selected.id,
        dwell_index: dwell.dwell_index,
        detection_id: d.detection_id,
      });
    }
    active = active
      .map((t) =>
        predict(
          { ...t, misses: used.has(t.id) ? 0 : t.misses + 1 },
          dwell.end_s,
          c
        )
      )
      .filter((t) => dwell.end_s - t.lastDetectionTime <= c.maxCoastSeconds);
    for (const t of active) {
      const state = used.has(t.id)
        ? t.hits >= 3
          ? "confirmed"
          : "tentative"
        : "coasting";
      tracks.push({
        track_id: t.id,
        dwell_index: dwell.dwell_index,
        time_s: dwell.end_s,
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
        dwell_index: dwell.dwell_index,
        time_s: dwell.end_s,
        hits: t.hits,
        last_detection_s: t.lastDetectionTime,
        ...Object.fromEntries(
          t.P.flatMap((row, i) => row.map((v, j) => [`p${i}${j}`, round(v)]))
        ),
      });
    }
  }
  return { tracks, associations, states };
}
export function simulateMilitary(c = scenarioConfigs.military) {
  const source = synthesizeMilitary(c),
    detected = detectMilitary(source.returns, source.schedule, c);
  return {
    ...source,
    ...detected,
    ...trackMilitary(detected.detections, source.schedule, c),
  };
}
export function secondaryTruthAt(time) {
  return [
    {
      target_id: "cooperative-a",
      east_m: 1200 + 18 * time,
      north_m: 3400 - 8 * time,
      up_m: 1400,
      transponder: "enabled",
      code: "0421",
      pressure_altitude_ft: 4600,
    },
    {
      target_id: "cooperative-b",
      east_m: -1500 + 11 * time,
      north_m: 2700 + 5 * time,
      up_m: 2100,
      transponder: "enabled",
      code: "6312",
      pressure_altitude_ft: 6800,
    },
    {
      target_id: "no-transponder",
      east_m: 250 + 5 * time,
      north_m: 2200 + 4 * time,
      up_m: 900,
      transponder: "disabled",
      code: "",
      pressure_altitude_ft: null,
    },
  ];
}
export function synthesizeSecondary(c = scenarioConfigs.secondary) {
  const rng = randomGenerator(c.seed),
    interrogations = [],
    decodedReplies = [],
    truth = [];
  for (let cycle = 0; cycle < c.cycles; cycle++)
    for (let slot = 0; slot < 4; slot++) {
      const start = cycle * c.cycleSeconds + slot * 0.8,
        end = start + 0.5,
        time = round(start + 0.3);
      const id = `interrogation-${String(interrogations.length + 1).padStart(
          3,
          "0"
        )}`,
        mode = slot % 2 === 0 ? "mode_a" : "mode_c",
        bearing = slot < 2 ? 30 : 330;
      const interrogation = {
        interrogation_id: id,
        start_s: round(start),
        end_s: round(end),
        beam_azimuth_deg: bearing,
        beam_width_deg: c.beamWidthDeg,
        mode,
      };
      interrogations.push(interrogation);
      for (const target of secondaryTruthAt(time)) {
        truth.push({
          target_id: target.target_id,
          interrogation_id: id,
          time_s: time,
          east_m: round(target.east_m),
          north_m: round(target.north_m),
          up_m: target.up_m,
          transponder: target.transponder,
        });
        const angle =
          (Math.atan2(target.east_m, target.north_m) / rad + 360) % 360;
        if (
          target.transponder === "disabled" ||
          Math.abs(wrap(angle - bearing)) > c.beamWidthDeg / 2
        )
          continue;
        // Authored receiver dropout means no retained reply. Interrogation is still retained.
        if (target.target_id === "cooperative-a" && cycle >= 6 && cycle <= 8)
          continue;
        if (target.target_id === "cooperative-b" && cycle === 10) continue;
        // A garbled decoded reply has no usable measurement or identity fields.
        const invalid = target.target_id === "cooperative-b" && cycle === 4;
        const missingAltitude =
          target.target_id === "cooperative-b" &&
          (cycle === 11 || cycle === 12);
        decodedReplies.push({
          reply_id: `reply-${String(decodedReplies.length + 1).padStart(
            3,
            "0"
          )}`,
          interrogation_id: id,
          time_s: time,
          available_s: round(time + c.processingDelaySeconds),
          slant_range_m: invalid
            ? null
            : round(
                Math.hypot(target.east_m, target.north_m, target.up_m) +
                  (rng() - 0.5) * 2 * c.rangeNoiseM
              ),
          bearing_deg: invalid
            ? null
            : round(
                (angle + (rng() - 0.5) * 2 * c.bearingNoiseDeg + 360) % 360
              ),
          validity: invalid ? "invalid" : "valid",
          mode_a_code: !invalid && mode === "mode_a" ? target.code : null,
          pressure_altitude_ft:
            !invalid && !missingAltitude && mode === "mode_c"
              ? target.pressure_altitude_ft
              : null,
        });
      }
    }
  return { interrogations, decodedReplies, truth };
}
export function deriveSecondaryReports(decodedReplies, interrogations) {
  const known = new Map(
    interrogations.map((row) => [row.interrogation_id, row])
  );
  const reports = [];
  for (const row of decodedReplies) {
    if (!known.has(row.interrogation_id))
      throw Error("Reply has no retained interrogation");
    if (row.validity !== "valid") continue;
    // No fusion, identity inference or altitude conversion: preserve decoded fields exactly.
    reports.push({
      report_id: `report-${String(reports.length + 1).padStart(3, "0")}`,
      ...row,
    });
  }
  return reports;
}
export function simulateSecondary(c = scenarioConfigs.secondary) {
  const source = synthesizeSecondary(c);
  return {
    ...source,
    reports: deriveSecondaryReports(
      source.decodedReplies,
      source.interrogations
    ),
  };
}
export function simulate(c = scenarioConfigs.military) {
  return c.scenario === "military"
    ? simulateMilitary(c)
    : c.scenario === "secondary"
    ? simulateSecondary(c)
    : (() => {
        throw Error("Unknown advanced radar scenario");
      })();
}
