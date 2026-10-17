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
  synthesize,
  preprocess,
  detect,
} from "./model.mjs";
import { trackDetections } from "../radar-scanning/model.mjs";
import { createPacket } from "./build.mjs";
const near = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
for (const [scenario, c] of Object.entries(scenarioConfigs)) {
  const m = simulate(c),
    cells = c.azimuthBins * c.rangeBins;
  test(`${scenario}: packet bytes and all fingerprints reproduce`, async () => {
    const a = await createPacket(scenario),
      b = await createPacket(scenario);
    assert.equal(a.files.size, 22);
    for (const [name, bytes] of a.files)
      assert.deepEqual(bytes, b.files.get(name), name);
    for (const [name, source] of Object.entries(a.index.sources)) {
      const bytes = a.files.get(name);
      assert.equal(bytes.length, source.byteLength);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        source.sha256
      );
    }
  });
  test(`${scenario}: retained model executes without repository imports`, async () => {
    const p = await createPacket(scenario),
      dir = await mkdtemp(path.join(tmpdir(), "site-radar-"));
    try {
      for (const file of ["model.mjs", "radar-scanning-model.mjs"])
        await writeFile(path.join(dir, file), p.files.get(file));
      const downloaded = await import(
        pathToFileURL(path.join(dir, "model.mjs")).href
      );
      assert.deepEqual(
        downloaded.simulate(downloaded.scenarioConfigs[scenario]),
        m
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test(`${scenario}: independent reference samples produce exact float32 means`, () => {
    for (let cell = 0; cell < cells; cell++) {
      let total = 0;
      for (let scan = 0; scan < c.referenceScans; scan++)
        total += m.referenceCapture[scan * cells + cell];
      assert.equal(
        m.backgroundPower[cell],
        Math.fround(total / c.referenceScans)
      );
    }
    const other = synthesize({ ...c, seed: c.seed + 1 });
    assert.notDeepEqual(other.returns, m.returns);
    assert.deepEqual(other.referenceCapture, m.referenceCapture);
    const newReference = synthesize({
      ...c,
      referenceSeed: c.referenceSeed + 1,
    });
    assert.notDeepEqual(newReference.referenceCapture, m.referenceCapture);
    assert.deepEqual(newReference.returns, m.returns);
  });
  test(`${scenario}: every retained residual derives from raw and background without zeroing exclusions`, () => {
    let excludedRaw = 0,
      excludedResidual = 0;
    for (let i = 0; i < m.returns.length; i++) {
      assert.equal(
        m.processedReturns[i],
        Math.fround(Math.max(0, m.returns[i] - m.backgroundPower[i % cells]))
      );
      if (!m.eligibility[i % cells]) {
        excludedRaw += m.returns[i] > 0;
        excludedResidual += m.processedReturns[i] > 0;
      }
    }
    assert.ok(excludedRaw > 0 && excludedResidual > 0);
    assert.ok(m.processedReturns.some((v) => v === 0));
  });
  test(`${scenario}: eligibility is static processing policy, independent of scene and receiver noise`, () => {
    const changed = synthesize({
      ...c,
      seed: c.seed + 20,
      referenceSeed: c.referenceSeed + 20,
    });
    assert.deepEqual(changed.eligibility, m.eligibility);
    assert.deepEqual(changed.siteFeatures, m.siteFeatures);
    assert.ok(m.eligibility.includes(0) && m.eligibility.includes(1));
    assert.ok(m.eligibility.every((v) => v === 0 || v === 1));
  });
  test(`${scenario}: detections use eligible processed cell power and exact cell-center geometry`, () => {
    for (const d of m.detections) {
      const cell = d.azimuth_index * c.rangeBins + d.range_index,
        index = d.scan_index * cells + cell,
        range = c.rangeOriginM + d.range_index * c.rangeStepM,
        bearing =
          ((c.azimuthOriginDeg + d.azimuth_index * c.azimuthStepDeg) *
            Math.PI) /
          180;
      assert.equal(m.eligibility[cell], 1);
      assert.equal(d.power, m.processedReturns[index]);
      assert.ok(d.power >= m.thresholds[index]);
      near(d.east_m, range * Math.sin(bearing));
      near(d.north_m, range * Math.cos(bearing));
      const dwell = m.schedule[d.scan_index * c.azimuthBins + d.azimuth_index];
      near(d.time_s, (dwell.start_s + dwell.end_s) / 2);
    }
  });
  test(`${scenario}: raw retained clutter produces additional peaks absent after subtraction`, () => {
    const raw = detect(m.returns, m.schedule, m.eligibility, c);
    assert.ok(raw.detections.length > m.detections.length + 20);
    assert.ok(
      m.detections.some(
        (d) => d.scan_index === 5 && d.east_m < 0 && d.north_m < 0
      ),
      "Temporary clutter change must remain a legitimate source peak"
    );
  });
  test(`${scenario}: preprocessing, detection and tracking have no scene or truth input`, () => {
    const protectedConfig = {
      ...c,
      get truth() {
        throw Error("Oracle read");
      },
      get targets() {
        throw Error("Oracle read");
      },
    };
    assert.deepEqual(
      preprocess(m.returns, m.referenceCapture, protectedConfig)
        .processedReturns,
      m.processedReturns
    );
    const detected = detect(
      m.processedReturns,
      m.schedule,
      m.eligibility,
      protectedConfig
    );
    assert.deepEqual(detected.detections, m.detections);
    assert.deepEqual(
      trackDetections(detected.detections, protectedConfig).tracks,
      m.tracks
    );
  });
  test(`${scenario}: empty power and fully excluded processing preserve empty results`, () => {
    const empty = detect(
      new Float32Array(m.processedReturns.length),
      m.schedule,
      m.eligibility,
      c
    );
    assert.deepEqual(empty.detections, []);
    assert.deepEqual(
      detect(m.processedReturns, m.schedule, new Uint8Array(cells), c)
        .detections,
      []
    );
    assert.deepEqual(trackDetections([], c), {
      tracks: [],
      associations: [],
      states: [],
    });
  });
  test(`${scenario}: tracker exports at scan end with source-linked updates and admissible covariance`, () => {
    const assigned = new Set();
    for (const a of m.associations) {
      assert.ok(!assigned.has(a.detection_id));
      assigned.add(a.detection_id);
      assert.ok(
        m.detections.some(
          (d) =>
            d.detection_id === a.detection_id && d.scan_index === a.scan_index
        )
      );
    }
    for (const t of m.tracks) {
      assert.equal(t.time_s, (t.scan_index + 1) * c.scanSeconds);
      assert.ok(
        t.cov_ee_m2 >= 0 &&
          t.cov_nn_m2 >= 0 &&
          t.cov_ee_m2 * t.cov_nn_m2 - t.cov_en_m2 ** 2 >= -1e-6
      );
    }
    assert.ok(m.tracks.some((t) => t.state === "coasting"));
  });
  test(`${scenario}: site geometry is closed where declared and has no moving target fields`, () => {
    const ids = [...new Set(m.siteFeatures.map((f) => f.feature_id))];
    for (const id of ids) {
      const rows = m.siteFeatures.filter((f) => f.feature_id === id);
      rows.forEach((r, i) => assert.equal(r.vertex_index, i));
      if (rows[0].closed) {
        assert.ok(rows.length >= 4);
        assert.equal(rows[0].east_m, rows.at(-1).east_m);
        assert.equal(rows[0].north_m, rows.at(-1).north_m);
      } else assert.ok(rows.length >= 2);
      assert.ok(
        rows.every(
          (r) => !Object.hasOwn(r, "target_id") && !Object.hasOwn(r, "time_s")
        )
      );
    }
  });
  test(`${scenario}: packet records an independent prior acquisition and raw source binding`, async () => {
    const p = await createPacket(scenario),
      ref = p.context.acquisitions.find((a) => a.id === "radar-reference"),
      main = p.context.acquisitions.find((a) => a.id === "radar-capture");
    assert.equal(ref.time.end, main.time.start);
    assert.ok(
      Date.parse(p.context.manifests[0].publishedAt) <=
        Date.parse(ref.time.start)
    );
    assert.equal(
      Date.parse(ref.time.end) - Date.parse(ref.time.start),
      c.referenceScans * c.scanSeconds * 1000
    );
    assert.equal(p.profile.acquisitionProductRef, "product:returns");
    assert.equal(
      p.profile.preprocessing.referenceAcquisitionProductRef,
      "product:referenceCapture"
    );
    assert.equal(
      p.context.products.find((x) => x.id === "referenceCapture").artifact
        .digest.value,
      p.index.files.referenceCapture.sha256
    );
  });
}
test("ground: omitted detections follow the retained exclusion mask rather than changing reception", () => {
  const c = scenarioConfigs.ground,
    m = simulate(c),
    all = detect(
      m.processedReturns,
      m.schedule,
      new Uint8Array(m.eligibility.length).fill(1),
      c
    );
  const excluded = all.detections.filter(
    (d) => !m.eligibility[d.azimuth_index * c.rangeBins + d.range_index]
  );
  assert.deepEqual(
    excluded.map((d) => d.scan_index),
    [13, 14, 15, 16]
  );
  const track = m.tracks.find(
    (t) => t.scan_index === 13 && t.east_m < 0
  ).track_id;
  assert.ok(
    m.tracks
      .filter(
        (t) => t.track_id === track && t.scan_index >= 14 && t.scan_index <= 16
      )
      .every((t) => t.state === "coasting")
  );
  assert.equal(
    m.tracks.find((t) => t.track_id === track && t.scan_index === 17).state,
    "confirmed"
  );
});
test("civilian: retained surface routes include a turn without giving classification to detections", () => {
  const m = simulate(scenarioConfigs.civilian);
  assert.ok(m.siteFeatures.some((f) => f.kind === "runway"));
  assert.ok(m.siteFeatures.some((f) => f.kind === "taxiway"));
  assert.ok(m.siteFeatures.some((f) => f.kind === "apron"));
  const source = m.truth.filter((t) => t.target_id === "surface-c");
  assert.ok(
    source.some((t) => t.time_s < 87.5 && t.east_m === -900 && t.north_m < 300)
  );
  assert.ok(
    source.some((t) => t.time_s > 87.5 && t.east_m > -900 && t.north_m === 300)
  );
  for (const d of m.detections)
    assert.equal(Object.hasOwn(d, "target_id"), false);
});
