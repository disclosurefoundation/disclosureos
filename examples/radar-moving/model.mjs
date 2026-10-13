// Seeded moving-platform radar teaching model. Not an RF or navigation-performance model.
import {
  config as fixedConfig,
  randomGenerator,
  offset,
  detect as detectPolar,
  trackDetections,
} from "../radar-scanning/model.mjs";
const rad = Math.PI / 180;
const wrap = (value) => ((value + 540) % 360) - 180;
const round = (value) => Number(value.toFixed(9));
export const scenarioConfigs = Object.freeze({
  airborne: Object.freeze({
    ...fixedConfig,
    seed: 20261014,
    scenario: "airborne",
    rangeOriginM: 50,
    rangeStepM: 100,
    measurementSigmaM: 75,
    platformSpeedMPerS: 34,
    platformHeadingDeg: 55,
    platformTurnRateDegPerS: 0.55,
    platformEastM: -1600,
    platformNorthM: -1200,
    platformUpM: 900,
    rangeResponseSigmaM: 70,
  }),
  shipborne: Object.freeze({
    ...fixedConfig,
    seed: 20261015,
    scenario: "shipborne",
    platformSpeedMPerS: 8,
    platformHeadingDeg: 20,
    platformTurnRateDegPerS: 0.8,
    platformEastM: -600,
    platformNorthM: -500,
    platformUpM: 0,
    rangeResponseSigmaM: 36,
  }),
});
export function platformAt(time, c) {
  const h0 = c.platformHeadingDeg * rad,
    omega = c.platformTurnRateDegPerS * rad;
  const h = h0 + omega * time;
  return {
    east_m:
      c.platformEastM +
      (c.platformSpeedMPerS / omega) * (Math.cos(h0) - Math.cos(h)),
    north_m:
      c.platformNorthM +
      (c.platformSpeedMPerS / omega) * (Math.sin(h) - Math.sin(h0)),
    up_m: c.platformUpM,
    heading_deg: (((h / rad) % 360) + 360) % 360,
  };
}
export function scenarioAt(time, scan, c) {
  if (c.scenario === "airborne")
    return [
      {
        target_id: "ground-a",
        east_m: 950 + 8 * time,
        north_m: 1700 - 3 * time,
        gain: scan >= 6 && scan <= 8 ? 0.015 : 4.2,
      },
      {
        target_id: "ground-b",
        east_m: -1900 + 4 * time,
        north_m: 2300 + 2 * time,
        gain: scan >= 11 && scan <= 12 ? 0.015 : 3.6,
      },
      { target_id: "ground-fixed", east_m: 2600, north_m: -500, gain: 2.8 },
    ];
  return [
    {
      target_id: "vessel-a",
      east_m: 500 + 7 * time,
      north_m: 1250 - 2 * time,
      gain: scan >= 6 && scan <= 8 ? 0.015 : 4.2,
    },
    {
      target_id: "vessel-b",
      east_m: -1100 + 4 * time,
      north_m: 800 + 3 * time,
      gain: scan >= 11 && scan <= 12 ? 0.015 : 3.4,
    },
    { target_id: "fixed-buoy", east_m: 1300, north_m: -100, gain: 2.7 },
  ];
}
export function cellPosition(pose, azimuthDeg, rangeM, c) {
  const squared =
    rangeM ** 2 - (c.scenario === "airborne" ? pose.up_m ** 2 : 0);
  if (squared < 0) return undefined;
  const horizontalRangeM = Math.sqrt(squared),
    bearing = (azimuthDeg + pose.heading_deg) * rad;
  return {
    east_m: pose.east_m + horizontalRangeM * Math.sin(bearing),
    north_m: pose.north_m + horizontalRangeM * Math.cos(bearing),
  };
}
const relative = (point, pose, c) => {
  const east = point.east_m - pose.east_m,
    north = point.north_m - pose.north_m;
  return {
    range: Math.hypot(east, north, c.scenario === "airborne" ? pose.up_m : 0),
    angle: wrap(Math.atan2(east, north) / rad - pose.heading_deg),
  };
};
export function synthesize(c = scenarioConfigs.airborne) {
  const rng = randomGenerator(c.seed),
    schedule = [],
    platformPose = [],
    truth = [];
  const returns = new Float32Array(c.scans * c.azimuthBins * c.rangeBins);
  for (let scan = 0; scan < c.scans; scan++)
    for (let az = 0; az < c.azimuthBins; az++) {
      const start = scan * c.scanSeconds + (az * c.scanSeconds) / c.azimuthBins,
        end = scan * c.scanSeconds + ((az + 1) * c.scanSeconds) / c.azimuthBins;
      const time = (start + end) / 2,
        angle = c.azimuthOriginDeg + az * c.azimuthStepDeg;
      const pose = platformAt(time, c);
      schedule.push({
        scan_index: scan,
        azimuth_index: az,
        start_s: round(start),
        end_s: round(end),
        beam_azimuth_deg: angle,
        beam_width_deg: c.beamWidthDeg,
      });
      platformPose.push({
        scan_index: scan,
        azimuth_index: az,
        time_s: round(time),
        ...Object.fromEntries(
          Object.entries(pose).map(([k, v]) => [k, round(v)]),
        ),
      });
      for (const target of scenarioAt(end, scan, c))
        truth.push({
          target_id: target.target_id,
          scan_index: scan,
          time_s: round(end),
          east_m: round(target.east_m),
          north_m: round(target.north_m),
        });
      const targets = scenarioAt(time, scan, c).map((target) => ({
        ...target,
        ...relative(target, pose, c),
      }));
      const clutterCenter =
        c.scenario === "airborne"
          ? { east_m: 100, north_m: 850 }
          : { east_m: 1350, north_m: 1300 };
      const clutter = relative(clutterCenter, pose, c);
      for (let bin = 0; bin < c.rangeBins; bin++) {
        const range = c.rangeOriginM + bin * c.rangeStepM;
        const thermal = -0.055 * Math.log(Math.max(1e-12, 1 - rng())),
          texture = 0.8 + 0.4 * rng();
        // The broad world-anchored component changes angle and range as ownship moves.
        const background =
          0.48 *
          Math.exp(-0.5 * (wrap(angle - clutter.angle) / 16) ** 2) *
          Math.exp(
            -0.5 *
              ((range - clutter.range) /
                (c.scenario === "airborne" ? 450 : 280)) **
                2,
          ) *
          texture;
        // The ship scene adds a short-range directional sea-return teaching component.
        const sea =
          c.scenario === "shipborne"
            ? 0.18 *
              Math.exp(-range / 700) *
              (0.45 +
                0.55 * Math.cos((angle + pose.heading_deg - 110) * rad) ** 2) *
              texture
            : 0;
        let power = 0.025 + thermal + background + sea;
        for (const target of targets)
          power +=
            target.gain *
            Math.exp(-0.5 * (wrap(angle - target.angle) / 2.1) ** 2) *
            Math.exp(
              -0.5 * ((range - target.range) / c.rangeResponseSigmaM) ** 2,
            );
        if (scan === 4) {
          const transient = relative(
            c.scenario === "airborne"
              ? { east_m: -2600, north_m: -1500 }
              : { east_m: -1800, north_m: -1000 },
            pose,
            c,
          );
          power +=
            2.4 *
            Math.exp(-0.5 * (wrap(angle - transient.angle) / 2.1) ** 2) *
            Math.exp(
              -0.5 * ((range - transient.range) / c.rangeResponseSigmaM) ** 2,
            );
        }
        returns[offset(scan, az, bin, c)] = power;
      }
    }
  return { returns, schedule, platformPose, truth };
}
export function detect(
  returns,
  schedule,
  platformPose,
  c = scenarioConfigs.airborne,
) {
  if (platformPose.length !== schedule.length)
    throw Error("A platform pose is required for every sampled dwell");
  // Detection cells and retained thresholds depend only on received power.
  const raw = detectPolar(returns, schedule, c),
    detections = [];
  for (const d of raw.detections) {
    // A peak below the slant-to-plane minimum has no declared location.
    if (
      !cellPosition(
        platformPose[d.scan_index * c.azimuthBins + d.azimuth_index],
        c.azimuthOriginDeg + d.azimuth_index * c.azimuthStepDeg,
        c.rangeOriginM + d.range_index * c.rangeStepM,
        c,
      )
    )
      continue;
    let sum = 0,
      east = 0,
      north = 0;
    for (let da = -1; da <= 1; da++)
      for (let dr = -1; dr <= 1; dr++) {
        const az = (d.azimuth_index + da + c.azimuthBins) % c.azimuthBins,
          bin = d.range_index + dr;
        const pose = platformPose[d.scan_index * c.azimuthBins + az];
        const position = cellPosition(
          pose,
          c.azimuthOriginDeg + az * c.azimuthStepDeg,
          c.rangeOriginM + bin * c.rangeStepM,
          c,
        );
        if (!position) continue;
        const weight = Math.max(
          0,
          returns[offset(d.scan_index, az, bin, c)] - 0.08,
        );
        sum += weight;
        east += weight * position.east_m;
        north += weight * position.north_m;
      }
    if (sum > 0)
      detections.push({
        ...d,
        detection_id: `detection-${String(detections.length + 1).padStart(3, "0")}`,
        east_m: round(east / sum),
        north_m: round(north / sum),
      });
  }
  return { thresholds: raw.thresholds, detections };
}
export function simulate(c = scenarioConfigs.airborne) {
  const source = synthesize(c),
    detection = detect(source.returns, source.schedule, source.platformPose, c);
  return {
    ...source,
    ...detection,
    ...trackDetections(detection.detections, c),
  };
}
