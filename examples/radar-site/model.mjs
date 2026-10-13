// Seeded horizontal site-surveillance examples. No operational performance claim.
import {
  config as baseConfig,
  randomGenerator,
  offset,
  trackDetections,
} from "../radar-scanning/model.mjs";
const rad = Math.PI / 180;
const round = (value) => Number(value.toFixed(9));
const wrap = (value) => ((value + 540) % 360) - 180;
export const scenarioConfigs = Object.freeze(
  Object.fromEntries(
    ["ground", "civilian"].map((scenario, i) => [
      scenario,
      Object.freeze({
        ...baseConfig,
        scenario,
        seed: 20261018 + i,
        referenceSeed: 20262018 + i,
        scans: 24,
        referenceScans: 8,
        azimuthBins: 180,
        azimuthStepDeg: 2,
        beamWidthDeg: 2.354820045,
        measurementSigmaM: 60,
        rangeResponseSigmaM: 36,
      }),
    ])
  )
);
export function sceneAt(time, scan, c) {
  if (c.scenario === "ground")
    return [
      {
        target_id: "scene-a",
        east_m: -1700 + 28 * time,
        north_m: 1200,
        gain: 4.2,
      },
      {
        target_id: "scene-b",
        east_m: 900,
        north_m: -1500 + 20 * time,
        gain: scan >= 11 && scan <= 13 ? 0.008 : 3.8,
      },
    ];
  return [
    {
      target_id: "surface-a",
      east_m: 700,
      north_m: -1100 + 22 * time,
      gain: 4.3,
    },
    {
      target_id: "surface-b",
      east_m: -850 + 9 * time,
      north_m: 300,
      gain: scan >= 9 && scan <= 11 ? 0.008 : 3.3,
    },
    {
      target_id: "surface-c",
      east_m: time <= 87.5 ? -900 : -900 + 8 * (time - 87.5),
      north_m: Math.min(300, -400 + 8 * time),
      gain: 2.9,
    },
  ];
}
const point = (az, range, c) => ({
  east_m: range * Math.sin((c.azimuthOriginDeg + az * c.azimuthStepDeg) * rad),
  north_m: range * Math.cos((c.azimuthOriginDeg + az * c.azimuthStepDeg) * rad),
});
export function siteFeatures(c) {
  const out = [];
  const add = (id, kind, label, vertices, closed) =>
    vertices.forEach(([east, north], vertex) =>
      out.push({
        feature_id: id,
        kind,
        label,
        vertex_index: vertex,
        east_m: east,
        north_m: north,
        closed: Number(closed),
      })
    );
  const polygon = (id, kind, label, e0, n0, e1, n1) =>
    add(
      id,
      kind,
      label,
      [
        [e0, n0],
        [e1, n0],
        [e1, n1],
        [e0, n1],
        [e0, n0],
      ],
      true
    );
  if (c.scenario === "ground") {
    polygon(
      "building-west",
      "structure",
      "West structure",
      -1050,
      600,
      -750,
      850
    );
    polygon(
      "building-east",
      "structure",
      "East structure",
      650,
      -750,
      950,
      -450
    );
    add(
      "service-road",
      "reference",
      "Authored service road",
      [
        [-2100, 1200],
        [1700, 1200],
      ],
      false
    );
    polygon(
      "excluded",
      "reference",
      "Detector exclusion",
      -170,
      1000,
      170,
      1500
    );
  } else {
    polygon("runway", "runway", "Runway", 650, -1400, 750, 1600);
    add(
      "taxiway-west",
      "taxiway",
      "West taxiway",
      [
        [-900, -700],
        [-900, 300],
        [650, 300],
      ],
      false
    );
    polygon("apron", "apron", "Apron", -1550, -550, -1050, 650);
    polygon("hangar", "structure", "Hangar", -1450, 750, -1100, 1050);
    polygon("terminal", "structure", "Terminal", -200, -800, 350, -500);
    polygon(
      "excluded",
      "reference",
      "Detector exclusion",
      -1600,
      -600,
      -1000,
      700
    );
  }
  return out;
}
export function eligibility(c) {
  const values = new Uint8Array(c.azimuthBins * c.rangeBins).fill(1);
  for (let az = 0; az < c.azimuthBins; az++)
    for (let bin = 0; bin < c.rangeBins; bin++) {
      const p = point(az, c.rangeOriginM + bin * c.rangeStepM, c);
      const excluded =
        c.scenario === "ground"
          ? p.east_m >= -170 &&
            p.east_m <= 170 &&
            p.north_m >= 1000 &&
            p.north_m <= 1500
          : p.east_m >= -1600 &&
            p.east_m <= -1000 &&
            p.north_m >= -600 &&
            p.north_m <= 700;
      if (excluded) values[az * c.rangeBins + bin] = 0;
    }
  return values;
}
export function backgroundAt(az, bin, c) {
  const angle = c.azimuthOriginDeg + az * c.azimuthStepDeg,
    range = c.rangeOriginM + bin * c.rangeStepM;
  const components =
    c.scenario === "ground"
      ? [
          { e: -900, n: 725, gain: 6, angleSigma: 4, rangeSigma: 95 },
          { e: 800, n: -600, gain: 4.5, angleSigma: 5, rangeSigma: 110 },
          { e: -450, n: 1450, gain: 0.9, angleSigma: 18, rangeSigma: 280 },
        ]
      : [
          { e: -1250, n: 900, gain: 7, angleSigma: 5, rangeSigma: 100 },
          { e: 100, n: -650, gain: 5, angleSigma: 12, rangeSigma: 110 },
          { e: -1320, n: 100, gain: 3.6, angleSigma: 14, rangeSigma: 160 },
        ];
  return components.reduce(
    (sum, p) =>
      sum +
      p.gain *
        Math.exp(
          -0.5 * (wrap(angle - Math.atan2(p.e, p.n) / rad) / p.angleSigma) ** 2
        ) *
        Math.exp(-0.5 * ((range - Math.hypot(p.e, p.n)) / p.rangeSigma) ** 2),
    0
  );
}
export function synthesize(c = scenarioConfigs.ground) {
  const referenceRng = randomGenerator(c.referenceSeed),
    rng = randomGenerator(c.seed),
    cells = c.azimuthBins * c.rangeBins;
  const referenceCapture = new Float32Array(c.referenceScans * cells),
    returns = new Float32Array(c.scans * cells),
    schedule = [],
    truth = [];
  const noise = (rng) => 0.025 - 0.055 * Math.log(Math.max(1e-12, 1 - rng()));
  for (let scan = 0; scan < c.referenceScans; scan++)
    for (let az = 0; az < c.azimuthBins; az++)
      for (let bin = 0; bin < c.rangeBins; bin++)
        referenceCapture[offset(scan, az, bin, c)] =
          noise(referenceRng) +
          backgroundAt(az, bin, c) * (0.96 + 0.08 * referenceRng());
  for (let scan = 0; scan < c.scans; scan++)
    for (let az = 0; az < c.azimuthBins; az++) {
      const start = scan * c.scanSeconds + (az * c.scanSeconds) / c.azimuthBins,
        end = scan * c.scanSeconds + ((az + 1) * c.scanSeconds) / c.azimuthBins,
        time = (start + end) / 2,
        angle = c.azimuthOriginDeg + az * c.azimuthStepDeg;
      schedule.push({
        scan_index: scan,
        azimuth_index: az,
        start_s: round(start),
        end_s: round(end),
        beam_azimuth_deg: angle,
        beam_width_deg: c.beamWidthDeg,
      });
      for (const t of sceneAt(end, scan, c))
        truth.push({
          target_id: t.target_id,
          scan_index: scan,
          time_s: round(end),
          east_m: round(t.east_m),
          north_m: round(t.north_m),
        });
      const targets = sceneAt(time, scan, c);
      for (let bin = 0; bin < c.rangeBins; bin++) {
        const range = c.rangeOriginM + bin * c.rangeStepM;
        let power =
          noise(rng) + backgroundAt(az, bin, c) * (0.96 + 0.08 * rng());
        for (const t of targets)
          power +=
            t.gain *
            Math.exp(
              -0.5 * wrap(angle - Math.atan2(t.east_m, t.north_m) / rad) ** 2
            ) *
            Math.exp(
              -0.5 *
                ((range - Math.hypot(t.east_m, t.north_m)) /
                  c.rangeResponseSigmaM) **
                  2
            );
        // A temporary clutter change survives a static background map and is not hidden by source truth.
        if (scan === 5)
          power +=
            1.9 *
            Math.exp(-0.5 * (wrap(angle - 240) / 2) ** 2) *
            Math.exp(-0.5 * ((range - 2100) / 40) ** 2);
        returns[offset(scan, az, bin, c)] = power;
      }
    }
  return {
    referenceCapture,
    returns,
    schedule,
    truth,
    eligibility: eligibility(c),
    siteFeatures: siteFeatures(c),
  };
}
export function preprocess(
  returns,
  referenceCapture,
  c = scenarioConfigs.ground
) {
  const cells = c.azimuthBins * c.rangeBins;
  if (
    returns.length !== c.scans * cells ||
    referenceCapture.length !== c.referenceScans * cells
  )
    throw Error("Source shape mismatch");
  const backgroundPower = new Float32Array(cells),
    processedReturns = new Float32Array(returns.length);
  for (let cell = 0; cell < cells; cell++) {
    let sum = 0;
    for (let ref = 0; ref < c.referenceScans; ref++)
      sum += referenceCapture[ref * cells + cell];
    backgroundPower[cell] = sum / c.referenceScans;
  }
  for (let i = 0; i < returns.length; i++)
    processedReturns[i] = Math.max(0, returns[i] - backgroundPower[i % cells]);
  return { backgroundPower, processedReturns };
}
export function detect(
  processedReturns,
  schedule,
  eligibility,
  c = scenarioConfigs.ground
) {
  const cells = c.azimuthBins * c.rangeBins;
  if (
    processedReturns.length !== c.scans * cells ||
    eligibility.length !== cells
  )
    throw Error("Detection input shape mismatch");
  const thresholds = new Float32Array(processedReturns.length),
    detections = [];
  for (let scan = 0; scan < c.scans; scan++)
    for (let az = 0; az < c.azimuthBins; az++) {
      for (let bin = 0; bin < c.rangeBins; bin++) {
        let sum = 0,
          n = 0;
        for (let d = -10; d <= 10; d++) {
          const b = bin + d;
          if (
            Math.abs(d) <= 2 ||
            b < 0 ||
            b >= c.rangeBins ||
            !eligibility[az * c.rangeBins + b]
          )
            continue;
          sum += processedReturns[offset(scan, az, b, c)];
          n++;
        }
        thresholds[offset(scan, az, bin, c)] = Math.max(
          0.6,
          n ? (4 * sum) / n : 0.6
        );
      }
      for (let bin = 1; bin < c.rangeBins - 1; bin++) {
        const cell = az * c.rangeBins + bin,
          i = offset(scan, az, bin, c),
          power = processedReturns[i];
        if (!eligibility[cell] || power < thresholds[i]) continue;
        let peak = true;
        for (let da = -1; da <= 1; da++)
          for (let dr = -1; dr <= 1; dr++) {
            if (!da && !dr) continue;
            const a = (az + da + c.azimuthBins) % c.azimuthBins,
              b = bin + dr,
              other = offset(scan, a, b, c);
            if (
              eligibility[a * c.rangeBins + b] &&
              (processedReturns[other] > power ||
                (processedReturns[other] === power && other < i))
            )
              peak = false;
          }
        if (!peak) continue;
        const d = schedule[scan * c.azimuthBins + az],
          p = point(az, c.rangeOriginM + bin * c.rangeStepM, c);
        detections.push({
          detection_id: `detection-${String(detections.length + 1).padStart(
            3,
            "0"
          )}`,
          scan_index: scan,
          azimuth_index: az,
          range_index: bin,
          time_s: round((d.start_s + d.end_s) / 2),
          east_m: round(p.east_m),
          north_m: round(p.north_m),
          power: Number(power),
        });
      }
    }
  return { thresholds, detections };
}
export function simulate(c = scenarioConfigs.ground) {
  const source = synthesize(c),
    processed = preprocess(source.returns, source.referenceCapture, c),
    detected = detect(
      processed.processedReturns,
      source.schedule,
      source.eligibility,
      c
    );
  return {
    ...source,
    ...processed,
    ...detected,
    ...trackDetections(detected.detections, c),
  };
}
