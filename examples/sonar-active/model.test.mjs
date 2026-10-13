import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config, simulate, envelope, retained } from "./model.mjs";
import { createPacket } from "./build.mjs";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("retained envelope and mask have reproducible dimensions and gaps", () => {
  const a = simulate(),
    b = simulate();
  assert.deepEqual(a, b);
  assert.equal(a.amplitudes.length, 64 * 256);
  assert.equal(a.receiveMask.length, 64 * 256);
  let missing = 0;
  for (let i = 0; i < a.amplitudes.length; i++) {
    const value = a.amplitudes[i];
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    if (!a.receiveMask[i]) {
      missing++;
      assert.equal(value, 0);
    }
  }
  assert.equal(missing, 960);
  assert.equal(retained(28, 40), false);
  assert.equal(retained(44, 125), false);
  assert.equal(retained(43, 125), true);
});
test("converging components and transient produce distinguishable retained envelope features", () => {
  assert.ok(envelope(0, 42) > 0.4);
  assert.ok(envelope(0, 189) > 0.25);
  assert.ok(envelope(50, 124) > 0.5);
  assert.ok(envelope(15, 222) > 0.25);
  assert.ok(envelope(0, 222) < 0.05);
  assert.ok(envelope(63, 222) < 0.05);
  assert.equal(
    (config.delayStepSeconds * 255 * config.soundSpeedMps) / 2,
    191.25
  );
});
test("packet index fingerprints match all retained sources, with no numerical display projection", async () => {
  const a = await createPacket(),
    b = await createPacket();
  assert.equal(a.files.size, 10);
  for (const [file, bytes] of a.files)
    assert.deepEqual(bytes, b.files.get(file), file);
  for (const [file, metadata] of Object.entries(a.index.sources)) {
    assert.equal(metadata.sha256, sha(a.files.get(file)));
    assert.equal(metadata.byteLength, a.files.get(file).length);
  }
  assert.equal(a.index.amplitudes, undefined);
  assert.equal(a.index.receiveMask, undefined);
});
