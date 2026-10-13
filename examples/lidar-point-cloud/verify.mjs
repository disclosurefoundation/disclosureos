import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPacket } from "./build.mjs";
import { evaluateLidarProfile } from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
const packet = await createPacket();
for (const [file, bytes] of packet.files)
  assert.deepEqual(
    await readFile(new URL(`generated/${file}`, import.meta.url)),
    bytes,
    `Regenerated ${file} differs`
  );
const result = await evaluateLidarProfile(
  packet.observation,
  packet.context,
  packet.selection,
  packet.profile,
  { assets: packet.assets }
);
assert.equal(result.success, true, JSON.stringify(result.issues));
console.log(
  JSON.stringify(
    {
      files: packet.files.size,
      ...packet.index.counts,
      checks: result.checks,
      scientific: result.scientific,
      physicalCalibration: result.physicalCalibration,
    },
    null,
    2
  )
);
