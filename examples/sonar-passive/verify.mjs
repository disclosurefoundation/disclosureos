import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket } from "./build.mjs";
import {
  evaluatePassiveSonarProfile,
  readProductSourceSelection,
  readPassiveSonarSample,
  readPassiveSonarBin,
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
  const result = await evaluatePassiveSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
  assert.equal(result.success, true, JSON.stringify(result.issues));
  for (let sample = 0; sample < p.index.config.samples; sample++) {
    const selected = readPassiveSonarSample(
      p.profile,
      result.data.products,
      sample
    );
    assert.equal(selected.available, Boolean(p.model.sampleMask[sample]));
    assert.equal(
      selected.pressure,
      selected.available ? p.model.pressure[sample] : null
    );
  }
  for (let frame = 0; frame < p.index.config.frames; frame++)
    for (let bin = 0; bin < p.index.config.frequencyBins; bin++) {
      const selected = readPassiveSonarBin(
          p.profile,
          result.data.products,
          frame,
          bin
        ),
        layout = p.selection.layouts.find(
          (v) => v.id === "powerSpectralDensity"
        );
      const exact = readProductSourceSelection(
        layout,
        { kind: "array_element", indices: [frame, bin] },
        p.assets.get(layout.productRef)
      );
      assert.equal(exact.byteOffset, selected.densityByteOffset);
      assert.equal(exact.value, selected.density ?? 0);
      assert.equal(selected.available, Boolean(p.model.frameMask[frame]));
      assert.equal(selected.startSample, frame * p.index.config.hopSamples);
    }
  return {
    success: true,
    files: p.files.size,
    pressureSamples: p.index.config.samples,
    spectralCells: p.index.config.frames * p.index.config.frequencyBins,
    retainedFrames: p.model.frameMask.filter(Boolean).length,
    unavailableFrames: p.model.frameMask.filter((v) => !v).length,
    reproduction: result.checks.reproduction,
    physicalCalibration: "not_performed",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await verify(process.argv[2]), null, 2));
