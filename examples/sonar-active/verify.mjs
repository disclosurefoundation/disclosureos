import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket } from "./build.mjs";
import {
  evaluateSonarProfile,
  readProductSourceSelection,
  readSonarSample,
} from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
const here = path.dirname(fileURLToPath(import.meta.url));
export async function verify(directory = path.join(here, "generated")) {
  const p = await createPacket();
  for (const [file, bytes] of p.files)
    assert.deepEqual(
      await readFile(path.join(directory, file)),
      bytes,
      `Generated file differs: ${file}`
    );
  const result = await evaluateSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
  assert.equal(result.success, true, JSON.stringify(result.issues));
  let retained = 0,
    missing = 0;
  for (let ping = 0; ping < p.index.config.pings; ping++)
    for (let bin = 0; bin < p.index.config.delayBins; bin++) {
      const selected = readSonarSample(
        p.profile,
        result.data.products,
        ping,
        bin
      );
      for (const layout of p.selection.layouts) {
        const cell = readProductSourceSelection(
          layout,
          { kind: "array_element", indices: [ping, bin] },
          p.assets.get(layout.productRef)
        );
        assert.equal(
          cell.byteOffset,
          layout.id === "amplitudes"
            ? selected.amplitudeByteOffset
            : selected.maskByteOffset
        );
        assert.equal(
          cell.value,
          layout.id === "amplitudes"
            ? selected.amplitude ?? 0
            : Number(selected.available)
        );
      }
      if (selected.available) retained++;
      else {
        missing++;
        assert.equal(selected.amplitude, null);
      }
    }
  return {
    success: true,
    files: p.files.size,
    retained,
    missing,
    selectedCells: retained + missing,
    scientific: "not_checked",
    physicalCalibration: "not_performed",
    propagationAccuracy: "not_checked",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await verify(process.argv[2]), null, 2));
