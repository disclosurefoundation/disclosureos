import test from "node:test";
import assert from "node:assert/strict";
import { config, simulate } from "./model.mjs";
import { createPacket } from "./build.mjs";
test("deterministic numerical model keeps six complete band planes and quality", () => {
  const a = simulate(),
    b = simulate();
  assert.deepEqual(a, b);
  assert.equal(a.dn.length, 6 * 72 * 96);
  assert.equal(a.quality.length, 72 * 96);
  for (let i = 0; i < a.quality.length; i++) {
    assert.ok(a.quality[i] >= 0 && a.quality[i] <= 3);
    for (let band = 0; band < 6; band++) {
      const v = a.dn[band * 6912 + i];
      if (a.quality[i] === 3) assert.equal(v, 65535);
      else assert.ok(v <= 10000 || (i === 583 && band === 3));
    }
  }
});
test("raw bands round trip little-endian without platform typed-array assumptions", async () => {
  const p = await createPacket(),
    m = simulate(),
    bytes = p.assets.get("product:reflectance");
  for (let i = 0; i < m.dn.length; i++)
    assert.equal(bytes.readUInt16LE(i * 2), m.dn[i]);
  assert.deepEqual(p.assets.get("product:quality"), Buffer.from(m.quality));
});
test("retained edge cases include zero denominator and partial-band absence", () => {
  const m = simulate();
  assert.equal(m.quality[582], 0);
  assert.equal(m.quality[583], 0);
  for (let b = 0; b < 6; b++) assert.equal(m.dn[b * 6912 + 582], 0);
  assert.equal(m.dn[3 * 6912 + 583], 65535);
  assert.notEqual(m.dn[2 * 6912 + 583], 65535);
  assert.equal(m.quality[config.defaultPixel], 0);
});
test("packet regeneration pins every file and records assumptions", async () => {
  const a = await createPacket(),
    b = await createPacket();
  assert.deepEqual(a.files, b.files);
  assert.equal(a.index.counts.pixels, 6912);
  assert.equal(a.profile.grid.registration, "authored_grid_not_surveyed");
  assert.equal(a.context.acquisitions[0].time.state, "unknown");
});
